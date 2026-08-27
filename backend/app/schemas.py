from pydantic import BaseModel, Field


class AyahErrorDetail(BaseModel):
    ayah_number: int
    reference_text: str
    recited_text: str
    status: str = "correct"  # "correct", "warning", "error", "missing"
    errors: list[dict] = Field(default_factory=list)
    ayah_wer: float | None = None
    ayah_cer: float | None = None


class AnalysisResponse(BaseModel):
    page: int = Field(ge=1, le=604)
    transcription: str
    reference: str
    wer: float | None = None
    cer: float | None = None
    accuracy: float = 0.0
    confidence: float = 0.0
    model: str
    device: str
    detected: bool = False
    detected_surah_number: int | None = None
    detected_surah_name: str | None = None
    detected_start_ayah: int | None = None
    detected_end_ayah: int | None = None
    ayah_errors: list[AyahErrorDetail] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    huggingface_configured: bool
    model: str


class TafsirResponse(BaseModel):
    surah_number: int = Field(ge=1, le=114)
    ayah_number: int = Field(ge=1)
    tafsir: str
    source: str
