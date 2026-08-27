"""Live transcription via WebSocket.

Each audio chunk received from the frontend is a complete, independently
valid WebM file (the frontend uses a periodic-restart approach — every 3 s
the MediaRecorder is stopped and restarted, producing a self-contained blob
with its own EBML header).

The backend simply writes each blob to a temp file and sends it to
HuggingFace Cloud Whisper.  No rolling buffer or header tracking is needed.
"""

import logging
import tempfile
import time
from pathlib import Path

from .huggingface import HuggingFaceWhisperClient, HuggingFaceInferenceError

logger = logging.getLogger(__name__)

# Minimum audio bytes before attempting transcription.  At ~32 kbps Opus
# this is roughly 0.5 s — enough for Whisper to produce meaningful output.
MIN_AUDIO_BYTES = 4000


async def process_live_chunk(audio_bytes: bytes) -> dict:
    """Transcribe an independent, self-contained audio chunk.

    Each call is stateless — the chunk is expected to be a complete WebM
    file with its own EBML header.
    """
    if len(audio_bytes) < MIN_AUDIO_BYTES:
        return {"type": "transcript", "text": ""}

    # Diagnostic: log magic bytes so we can verify the frontend is sending
    # valid WebM data.
    magic_hex = audio_bytes[:8].hex() if len(audio_bytes) >= 8 else audio_bytes.hex()
    has_header = (
        len(audio_bytes) >= 4
        and audio_bytes[0] == 0x1A
        and audio_bytes[1] == 0x45
        and audio_bytes[2] == 0xDF
        and audio_bytes[3] == 0xA3
    )
    logger.info(
        "Live chunk: %d bytes, magic=%s, validWebM=%s, language=ar",
        len(audio_bytes), magic_hex, has_header,
    )

    client = HuggingFaceWhisperClient()

    started = time.perf_counter()
    try:
        # Write to a temp .webm file so HF resolves the correct MIME type
        # from the extension (avoiding Windows' video/webm issue).
        tmp = Path(tempfile.gettempdir()) / "live-chunk.webm"
        tmp.write_bytes(audio_bytes)
        transcription = await client.transcribe(audio_bytes, "live-chunk.webm", "audio/webm")
    except HuggingFaceInferenceError as exc:
        elapsed_ms = round((time.perf_counter() - started) * 1000)
        logger.warning("Live ASR failed after %dms: %s", elapsed_ms, exc)
        return {"type": "error", "error": str(exc)}
    except Exception as exc:
        elapsed_ms = round((time.perf_counter() - started) * 1000)
        logger.error("Live ASR unexpected error after %dms: %s", elapsed_ms, exc, exc_info=True)
        return {"type": "error", "error": str(exc)}

    elapsed_ms = round((time.perf_counter() - started) * 1000)
    logger.info("Live transcript: %dms, %d chars", elapsed_ms, len(transcription))

    return {
        "type": "transcript",
        "text": transcription,
        "transcription_ms": elapsed_ms,
        "audio_duration_ms": round(len(audio_bytes) / 16),
    }
