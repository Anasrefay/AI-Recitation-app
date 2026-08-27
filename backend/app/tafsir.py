import json
from pathlib import Path
from functools import lru_cache

TAFSIR_PATH = Path(__file__).resolve().parents[2] / "ar-tafsir-qurtubi.json"


@lru_cache(maxsize=1)
def load_tafsir() -> list[list[str]]:
    with TAFSIR_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def get_tafsir_for_ayah(surah_number: int, ayah_number: int) -> str | None:
    """Return the tafsir text for a given surah (1-114) and ayah (1-based)."""
    data = load_tafsir()
    surah_idx = surah_number - 1
    ayah_idx = ayah_number - 1

    if surah_idx < 0 or surah_idx >= len(data):
        return None

    surah_tafsir = data[surah_idx]
    if ayah_idx < 0 or ayah_idx >= len(surah_tafsir):
        return None

    return surah_tafsir[ayah_idx]


def get_tafsir_for_surah(surah_number: int) -> list[str] | None:
    """Return all ayah tafsirs for a given surah (1-114)."""
    data = load_tafsir()
    surah_idx = surah_number - 1

    if surah_idx < 0 or surah_idx >= len(data):
        return None

    return data[surah_idx]
