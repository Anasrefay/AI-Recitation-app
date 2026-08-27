import asyncio
import json
import logging
import time

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from jiwer import process_words, process_characters

from .config import get_settings
from .huggingface import HuggingFaceWhisperClient, HuggingFaceInferenceError
from .live import process_live_chunk
from .quran import (
    normalize_arabic,
    detect_verse_range,
    load_quran,
    _split_into_segments,
)
from .schemas import (
    AnalysisResponse,
    AyahErrorDetail,
    HealthResponse,
    TafsirResponse,
)
from .tafsir import get_tafsir_for_ayah, get_tafsir_for_surah

logger = logging.getLogger(__name__)
settings = get_settings()

ALLOWED_AUDIO_TYPES = {
    "audio/webm",
    "audio/ogg",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/wav",
    "audio/x-wav",
    "audio/flac",
}

app = FastAPI(
    title="Quran AI Recitation API",
    version="5.0.0",
    description="Hugging Face Cloud Whisper ASR for Quran recitation transcription and verse detection.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.websocket("/ws/live-transcribe")
async def live_transcribe_ws(websocket: WebSocket):
    await websocket.accept()

    try:
        init_msg = await websocket.receive_text()
        json.loads(init_msg)  # validate
    except Exception:
        await websocket.close(code=4000, reason="Invalid init message")
        return

    processing_task: asyncio.Task | None = None
    send_lock = asyncio.Lock()
    last_request_time = 0.0
    MIN_INTERVAL = 0.8  # seconds between HF requests
    pending: bytes | None = None
    pending_lock = asyncio.Lock()

    async def send_result(payload: dict):
        async with send_lock:
            try:
                await websocket.send_text(json.dumps(payload, ensure_ascii=False))
            except Exception:
                pass

    async def process_one(data: bytes):
        nonlocal last_request_time, pending, processing_task

        elapsed = time.perf_counter() - last_request_time
        if elapsed < MIN_INTERVAL:
            await asyncio.sleep(MIN_INTERVAL - elapsed)

        last_request_time = time.perf_counter()
        result = await process_live_chunk(data)
        await send_result(result)

        # If more data arrived while we were processing, schedule another round
        async with pending_lock:
            if pending is not None:
                next_data = pending
                pending = None
                processing_task = asyncio.create_task(process_one(next_data))
            else:
                processing_task = None

    try:
        while True:
            message = await websocket.receive()

            if message["type"] == "websocket.disconnect":
                break

            if message.get("text"):
                try:
                    ctrl = json.loads(message["text"])
                    if ctrl.get("action") == "stop":
                        break
                except json.JSONDecodeError:
                    pass
                continue

            if message.get("bytes"):
                async with pending_lock:
                    pending = message["bytes"]
                if processing_task is None or processing_task.done():
                    async with pending_lock:
                        data = pending
                        pending = None
                    if data:
                        processing_task = asyncio.create_task(process_one(data))

    except WebSocketDisconnect:
        logger.info("Live transcription client disconnected")
    except Exception as exc:
        logger.error("Live transcription error: %s", exc, exc_info=True)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        huggingface_configured=bool(settings.hf_token),
        model=settings.hf_model_id,
    )


@app.get("/api/v1/tafsir/{surah_number}/{ayah_number}", response_model=TafsirResponse)
async def get_ayah_tafsir(surah_number: int, ayah_number: int):
    if not 1 <= surah_number <= 114:
        raise HTTPException(status_code=400, detail="Surah number must be between 1 and 114.")
    if ayah_number < 1:
        raise HTTPException(status_code=400, detail="Ayah number must be >= 1.")

    text = get_tafsir_for_ayah(surah_number, ayah_number)
    if text is None:
        raise HTTPException(status_code=404, detail="Tafsir not found for this ayah.")

    return TafsirResponse(
        surah_number=surah_number,
        ayah_number=ayah_number,
        tafsir=text,
        source="تفسير القرطبي",
    )


@app.get("/api/v1/tafsir/{surah_number}", response_model=list[TafsirResponse])
async def get_surah_tafsir(surah_number: int):
    if not 1 <= surah_number <= 114:
        raise HTTPException(status_code=400, detail="Surah number must be between 1 and 114.")

    data = get_tafsir_for_surah(surah_number)
    if data is None:
        raise HTTPException(status_code=404, detail="Tafsir not found for this surah.")

    return [
        TafsirResponse(
            surah_number=surah_number,
            ayah_number=i + 1,
            tafsir=t,
            source="تفسير القرطبي",
        )
        for i, t in enumerate(data)
    ]


def _get_page_surah_ids(page: int) -> list[int]:
    surah_ids: list[int] = []
    for surah in load_quran():
        for verse in surah.get("verses", []):
            if verse.get("page") == page:
                surah_ids.append(surah["id"])
                break
    return surah_ids


def _build_per_ayah_analysis(
    transcription: str,
    detection: dict,
) -> list[AyahErrorDetail]:
    ayah_details: list[AyahErrorDetail] = []
    surah_id = detection["surah_id"]
    start = detection["start_ayah"]
    end = detection["end_ayah"]

    quran = load_quran()
    surah_data = next((s for s in quran if s["id"] == surah_id), None)
    if not surah_data:
        return ayah_details

    ref_ayahs = [
        v for v in surah_data.get("verses", [])
        if start <= v["id"] <= end
    ]
    if not ref_ayahs:
        return ayah_details

    trans_norm = normalize_arabic(transcription)
    trans_tokens = _split_into_segments(trans_norm)

    total_ref_tokens = sum(
        len(_split_into_segments(normalize_arabic(v.get("text", ""))))
        for v in ref_ayahs
    )
    if total_ref_tokens == 0:
        return ayah_details

    trans_idx = 0
    for verse in ref_ayahs:
        ayah_num = verse["id"]
        ref_text = verse.get("text", "")
        ref_norm = normalize_arabic(ref_text)
        ref_tokens = _split_into_segments(ref_norm)

        proportion = len(ref_tokens) / total_ref_tokens if total_ref_tokens > 0 else 0
        tokens_for_ayah = max(1, round(len(trans_tokens) * proportion))

        ayah_trans_tokens = trans_tokens[trans_idx:trans_idx + tokens_for_ayah]
        trans_idx += tokens_for_ayah

        if not ayah_trans_tokens:
            ayah_details.append(AyahErrorDetail(
                ayah_number=ayah_num, reference_text=ref_text, recited_text="",
                status="missing",
                errors=[{"type": "missing", "message": "لم يتم تسجيل هذه الآية"}],
            ))
            continue

        ref_joined = " ".join(ref_tokens)
        trans_joined = " ".join(ayah_trans_tokens)

        try:
            word_output = process_words(ref_joined, trans_joined)
            char_output = process_characters(ref_joined, trans_joined)
        except Exception:
            ayah_details.append(AyahErrorDetail(
                ayah_number=ayah_num, reference_text=ref_text,
                recited_text=" ".join(ayah_trans_tokens),
                status="error", errors=[],
            ))
            continue

        errors: list[dict] = []
        refs = word_output.references[0]
        hyps = word_output.hypotheses[0]

        for chunk in word_output.alignments[0]:
            ref_slice = refs[chunk.ref_start_idx:chunk.ref_end_idx]
            hyp_slice = hyps[chunk.hyp_start_idx:chunk.hyp_end_idx]

            if chunk.type == "substitute":
                errors.append({
                    "type": "substitution",
                    "expected": " ".join(ref_slice),
                    "actual": " ".join(hyp_slice),
                    "message": f"❌ كلمة خاطئة: '{' '.join(hyp_slice)}' → الصحيح: '{' '.join(ref_slice)}'",
                })
            elif chunk.type == "delete":
                errors.append({
                    "type": "missing",
                    "expected": " ".join(ref_slice),
                    "message": f"⚠️ كلمة ناقصة: '{' '.join(ref_slice)}'",
                })
            elif chunk.type == "insert":
                errors.append({
                    "type": "extra",
                    "actual": " ".join(hyp_slice),
                    "message": f"➕ كلمة زائدة: '{' '.join(hyp_slice)}'",
                })

        has_errors = len(errors) > 0
        ayah_wer = word_output.wer
        ayah_cer = char_output.cer

        if not has_errors:
            status = "correct"
        elif ayah_wer > 0.5:
            status = "error"
        else:
            status = "warning"

        ayah_details.append(AyahErrorDetail(
            ayah_number=ayah_num, reference_text=ref_text,
            recited_text=" ".join(ayah_trans_tokens),
            status=status, errors=errors,
            ayah_wer=round(ayah_wer, 4), ayah_cer=round(ayah_cer, 4),
        ))

    return ayah_details


async def _run_transcription(audio_data: bytes, content_type: str, filename: str) -> str:
    """Run HuggingFace Cloud Whisper transcription."""
    client = HuggingFaceWhisperClient()
    return await client.transcribe(audio_data, filename, content_type)


@app.post("/api/v1/recitations/analyze", response_model=AnalysisResponse)
async def analyze_recitation(
    page: int = Form(...),
    audio: UploadFile = File(...),
):
    if not 1 <= page <= 604:
        raise HTTPException(status_code=400, detail="Page must be between 1 and 604.")
    if not audio.filename:
        raise HTTPException(status_code=400, detail="Audio file is required.")

    content_type = (audio.content_type or "").lower()
    base_type = content_type.split(";")[0].strip() if content_type else ""
    if base_type and base_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported audio format: {content_type}")

    data = await audio.read()
    max_bytes = settings.max_audio_mb * 1024 * 1024

    if not data:
        raise HTTPException(status_code=400, detail="Audio file is empty.")
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Audio file exceeds {settings.max_audio_mb} MB.")

    started = time.perf_counter()

    try:
        transcription = await _run_transcription(
            data, content_type or "application/octet-stream", audio.filename,
        )
    except HuggingFaceInferenceError as exc:
        logger.error("HuggingFace transcription failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Unexpected transcription error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="حدث خطأ غير متوقع أثناء التحليل.") from exc

    elapsed_ms = round((time.perf_counter() - started) * 1000)
    logger.info("Transcription took %dms: %d chars", elapsed_ms, len(transcription))

    hint_surah_ids = _get_page_surah_ids(page)

    detection = detect_verse_range(
        transcription,
        hint_surah_ids=tuple(set(hint_surah_ids)) if hint_surah_ids else None,
    )

    if detection:
        confidence = detection["confidence"]
        detected = confidence >= 0.4
        surah_name = detection["surah_name"] if detected else None
        det_surah_num = detection["surah_id"] if detected else None
        det_start = detection["start_ayah"] if detected else None
        det_end = detection["end_ayah"] if detected else None
        reference = detection["reference_text"] if detected else ""
        ayah_errors = _build_per_ayah_analysis(transcription, detection) if detected else []
    else:
        confidence = 0.0
        detected = False
        surah_name = None
        det_surah_num = None
        det_start = None
        det_end = None
        reference = ""
        ayah_errors = []

    ref_n = normalize_arabic(reference) if reference else ""
    hyp_n = normalize_arabic(transcription)

    if ref_n and hyp_n:
        word_out = process_words(ref_n, hyp_n)
        char_out = process_characters(ref_n, hyp_n)
        w = min(1.0, float(word_out.wer))
        c = min(1.0, float(char_out.cer))
        score = max(0.0, min(1.0, 1.0 - (0.7 * w + 0.3 * c)))
    else:
        w = None
        c = None
        score = 0.0

    return AnalysisResponse(
        page=page,
        transcription=transcription,
        reference=reference,
        wer=w,
        cer=c,
        accuracy=round(score * 100, 2),
        confidence=round(confidence * 100, 2),
        model=settings.hf_model_id,
        device=settings.hf_provider,
        detected=detected,
        detected_surah_number=det_surah_num,
        detected_surah_name=surah_name,
        detected_start_ayah=det_start,
        detected_end_ayah=det_end,
        ayah_errors=ayah_errors,
    )
