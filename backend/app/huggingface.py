import asyncio
import base64
import json
import logging
import mimetypes

# Windows classifies .webm as video/webm; the HF API expects audio/webm.
mimetypes.add_type('audio/webm', '.webm')
mimetypes.add_type('audio/ogg', '.ogg')

import aiohttp

from .config import get_settings

logger = logging.getLogger(__name__)


class HuggingFaceInferenceError(Exception):
    """Raised when Hugging Face Inference Providers cannot complete inference."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class HuggingFaceWhisperClient:
    """Direct aiohttp client for the HF Inference API Whisper endpoint.

    Bypasses huggingface_hub's ``automatic_speech_recognition`` method
    because:

    1. Without parameters it sends raw bytes — no way to force Arabic.
    2. With parameters (via ``extra_body``) it wraps audio as base64 JSON
       but puts everything inside a top-level ``"parameters"`` key.
       The HF Inference Providers API router does NOT unpack that dict
       into pipeline kwargs — it passes ``parameters={"language": "ar"}``
       as a single kwarg to ``_sanitize_parameters()``, which rejects it
       with HTTP 400.

    The fix: build the JSON+base64 payload ourselves and place ``language``
    inside ``generation_parameters`` — the structure the HF API spec
    documents for passing generation kwargs to the model's ``generate()``
    method.  This forces Arabic-script output instead of Latin
    transliteration.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.token = settings.hf_token
        self.model_id = settings.hf_model_id
        self.provider = settings.hf_provider
        self.timeout = settings.hf_timeout_seconds
        self._url = (
            f"https://router.huggingface.co/{self.provider}"
            f"/models/{self.model_id}"
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def transcribe(
        self,
        audio: bytes,
        filename: str,
        content_type: str | None,
    ) -> str:
        """Transcribe audio via the HF Inference API (Whisper).

        Forces ``language="ar"`` so Whisper outputs Arabic script rather
        than Latin transliteration.  The audio is base64-encoded and sent
        as JSON per the HF API spec (raw-bytes mode does not support
        passing parameters).
        """
        if not self.token:
            raise HuggingFaceInferenceError(
                "HF_TOKEN is not configured. Please set it in backend/.env"
            )
        if not audio:
            raise HuggingFaceInferenceError("Audio payload is empty.")

        ct = self._resolve_content_type(filename, content_type)
        magic_hex = audio[:8].hex() if len(audio) >= 8 else audio.hex()

        logger.info(
            "ASR request: model=%s size=%d ct=%s magic=%s language=ar",
            self.model_id, len(audio), ct, magic_hex,
        )

        # ---- Build JSON+base64 payload --------------------------------
        # HF Inference API spec for ASR:
        #   inputs   – base64-encoded audio (string) OR raw bytes when
        #              no parameters are provided.
        #   parameters.return_timestamps       – boolean
        #   parameters.generation_parameters   – object forwarded to
        #              model.generate() as **kwargs.
        #
        # "language" is a Whisper generate() kwarg, NOT a top-level
        # parameters key.  Placing it in generation_parameters is the
        # documented way to pass it through the HF API.
        b64_audio = base64.b64encode(audio).decode("ascii")
        payload = {
            "inputs": b64_audio,
            "parameters": {
                "generation_parameters": {
                    "language": "ar",
                },
            },
        }

        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

        # Cap at 30 s so live ASR fails fast. The config value (30) is
        # already sensible, but enforce a hard ceiling here.
        effective_timeout = min(self.timeout, 30)
        timeout = aiohttp.ClientTimeout(total=effective_timeout)

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self._url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers=headers,
                    timeout=timeout,
                ) as resp:
                    body_text = await resp.text()

                    if resp.status != 200:
                        logger.error(
                            "HF API error: status=%d url=%s body=%s",
                            resp.status, self._url, body_text[:500],
                        )
                        raise HuggingFaceInferenceError(
                            f"Hugging Face API error (HTTP {resp.status}): "
                            f"{body_text[:300]}",
                            status_code=resp.status,
                        )

                    # ---- Parse response --------------------------------
                    # The HF API returns {"text": "..."} for ASR.
                    try:
                        result = json.loads(body_text)
                    except (json.JSONDecodeError, ValueError) as exc:
                        logger.error(
                            "HF API returned non-JSON (first 200 chars): %s",
                            body_text[:200],
                        )
                        raise HuggingFaceInferenceError(
                            f"HF API returned invalid JSON: {body_text[:200]}"
                        ) from exc

                    text = ""
                    if isinstance(result, dict):
                        text = str(result.get("text", "")).strip()
                    elif isinstance(result, str):
                        text = result.strip()

                    if not text:
                        logger.error(
                            "HF API returned empty transcription. "
                            "Full response (first 300 chars): %s",
                            body_text[:300],
                        )
                        raise HuggingFaceInferenceError(
                            "Hugging Face returned an empty transcription."
                        )

                    logger.info(
                        "Transcription complete: %d chars", len(text),
                    )
                    return text

        except aiohttp.ClientResponseError as exc:
            logger.error("HF HTTP error: %s", exc, exc_info=True)
            raise HuggingFaceInferenceError(
                f"Hugging Face API error: {exc}",
                status_code=exc.status,
            ) from exc
        except asyncio.TimeoutError:
            logger.error(
                "HF inference timed out after %ds (url=%s)",
                effective_timeout, self._url,
            )
            raise HuggingFaceInferenceError(
                f"Hugging Face inference timed out after {effective_timeout}s."
            )
        except HuggingFaceInferenceError:
            raise
        except Exception as exc:
            logger.error("HF unexpected error: %s", exc, exc_info=True)
            raise HuggingFaceInferenceError(
                f"Could not run Hugging Face ASR for model "
                f"'{self.model_id}': {exc}"
            ) from exc

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _resolve_content_type(filename: str, content_type: str | None) -> str:
        """Resolve a MIME content type from the Content-Type header and/or
        filename.  Falls back to ``audio/webm``."""
        ct = (content_type or "").lower().split(";")[0].strip()
        if ct and ct.startswith("audio/"):
            return ct
        if filename:
            guessed = mimetypes.guess_type(filename)[0]
            if guessed:
                return guessed
        return "audio/webm"
