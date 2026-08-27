from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "production"
    cors_origins: str = "http://localhost:3000"

    # Hugging Face Inference API (Cloud Whisper)
    hf_token: str = ""
    hf_model_id: str = "openai/whisper-large-v3-turbo"
    hf_provider: str = "hf-inference"
    hf_timeout_seconds: int = 30

    max_audio_mb: int = 25
    transcription_timeout: float = 60.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
