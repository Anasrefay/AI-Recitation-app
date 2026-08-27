import json
import re
from pathlib import Path
from functools import lru_cache

DATA_PATH = Path(__file__).resolve().parents[2] / "quran_data.json"

SURAH_NAMES = [
    "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة",
    "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
    "هود", "يوسف", "الرعد", "إبراهيم", "الحجر",
    "النحل", "الإسراء", "الكهف", "مريم", "طه",
    "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان",
    "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
    "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر",
    "يس", "الصافات", "ص", "الزمر", "غافر",
    "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية",
    "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
    "الذاريات", "الطور", "النجم", "القمر", "الرحمن",
    "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
    "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق",
    "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
    "نوح", "الجن", "المزمل", "المدثر", "القيامة",
    "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
    "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج",
    "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
    "الشمس", "الليل", "الضحى", "الشرح", "التين",
    "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
    "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل",
    "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
    "المسد", "الإخلاص", "الفلق", "الناس",
]


@lru_cache(maxsize=1)
def load_quran() -> list[dict]:
    with DATA_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


_STRIP_RE = re.compile(
    "["
    "\u0610-\u061A"
    "\u064B-\u065F"
    "\u0670"
    "\u06D6-\u06DC"
    "\u06DD"
    "\u06DE"
    "\u06DF-\u06E4"
    "\u06E5-\u06E8"
    "\u06E9-\u06EF"
    "\u200C-\u200F"
    "\u2010-\u2027"
    "\u2028-\u2069"
    "\uFE70-\uFEFF"
    "\u0640"
    "]"
)


def normalize_arabic(text: str) -> str:
    text = _STRIP_RE.sub("", text)
    text = (
        text
        .replace("\u0671", "\u0627")
        .replace("\u0622", "\u0627")
        .replace("\u0623", "\u0627")
        .replace("\u0625", "\u0627")
        .replace("\u0621", "\u0627")
        .replace("\u0649", "\u064A")
        .replace("\u0629", "\u0647")
    )
    text = re.sub(r"\s+", " ", text).strip()
    for particle in ["ولا", "فلا", "ولم", "فلم", "و ما", "فما", "و لا", "من غير", "و من"]:
        joined = particle.replace(" ", "")
        text = text.replace(particle, joined)
    text = text.replace("صراط", "صرط")
    uthmani_expand = [
        ("الكتب", "الكتاب"),
        ("رزقنهم", "رزقناهم"),
        ("ويقيمون", "وقيمون"),
        ("رحمت", "رحمة"),
        ("السموت", "السماوات"),
        ("السمآت", "السماوات"),
        ("يوده", "يئوده"),
        ("حفظهما", "حفظه"),
        ("ومن يتق", "ومن يتقي"),
        ("رحمه", "رحمة"),
    ]
    for old, new in uthmani_expand:
        text = text.replace(old, new)

    # Common Whisper ASR variations for Quran Arabic
    asr_fixes = [
        ("اباك", "اياك"),        # Whisper b/y confusion: اباك → اياك
        ("العالمين", "العلمين"),  # Whisper inserts extra alef: العالمين → العلمين
        ("مالك", "ملك"),         # Quran superscript alef strips to ملك, Whisper says مالك
    ]
    for old, new in asr_fixes:
        text = text.replace(old, new)

    return text


def page_reference(page: int) -> str:
    chunks = []
    for surah in load_quran():
        for verse in surah.get("verses", []):
            verse_page = verse.get("page")
            if verse_page == page:
                chunks.append(verse.get("text", ""))
    return " ".join(chunks)


@lru_cache(maxsize=1)
def _build_ayah_index() -> list[dict]:
    index = []
    for surah in load_quran():
        surah_id = surah["id"]
        surah_name = SURAH_NAMES[surah_id - 1] if 1 <= surah_id <= 114 else surah.get("name", "")
        for verse in surah.get("verses", []):
            text = verse.get("text", "")
            index.append({
                "surah_id": surah_id,
                "surah_name": surah_name,
                "ayah_id": verse["id"],
                "text": text,
                "normalized": normalize_arabic(text),
            })
    return index


def _split_into_segments(text: str) -> list[str]:
    return [t for t in text.split() if t]


def _match_tokens(ayah_tokens: list[str], trans_tokens: list[str], offset: int) -> tuple[int, int]:
    t_pos = 0
    matched = 0
    consecutive_misses = 0
    for a_token in ayah_tokens:
        found = False
        while t_pos + offset < len(trans_tokens):
            if trans_tokens[offset + t_pos] == a_token:
                t_pos += 1
                matched += 1
                found = True
                consecutive_misses = 0
                break
            if t_pos < 3:
                t_pos += 1
                consecutive_misses += 1
            else:
                break
        if not found:
            if consecutive_misses >= 5:
                break
            continue
    return (t_pos, matched) if matched > 0 else (0, 0)


def detect_verse_range(
    transcription: str,
    hint_surah_ids: tuple[int, ...] | None = None,
) -> dict | None:
    normalized_transcription = normalize_arabic(transcription)
    if not normalized_transcription:
        return None

    trans_tokens = _split_into_segments(normalized_transcription)
    trans_token_count = len(trans_tokens)
    if trans_token_count < 3:
        return None

    ayah_index = _build_ayah_index()
    surah_ayahs: dict[int, list[dict]] = {}
    for entry in ayah_index:
        surah_ayahs.setdefault(entry["surah_id"], []).append(entry)

    best_match = None
    best_score = 0

    for surah_id, ayahs in surah_ayahs.items():
        ayahs_sorted = sorted(ayahs, key=lambda a: a["ayah_id"])

        for start_idx in range(len(ayahs_sorted)):
            matched_tokens = 0
            actual_matches = 0
            matched_ayahs = 0
            end_idx = start_idx

            for i in range(start_idx, min(start_idx + 30, len(ayahs_sorted))):
                ayah = ayahs_sorted[i]
                ayah_tokens = _split_into_segments(ayah["normalized"])
                if not ayah_tokens:
                    continue

                consumed, hits = _match_tokens(ayah_tokens, trans_tokens, matched_tokens)
                if hits > 0:
                    matched_tokens += consumed
                    actual_matches += hits
                    matched_ayahs += 1
                    end_idx = i
                else:
                    break

            if matched_ayahs > 0 and actual_matches >= 4:
                coverage = matched_tokens / trans_token_count

                # Require high coverage: at least 50% of transcription must be consumed
                if coverage < 0.5:
                    continue

                # Require meaningful match: at least 40% of matched tokens were real hits
                if actual_matches < matched_tokens * 0.4:
                    continue

                score = int(coverage * 1000) + matched_ayahs * 20
                if hint_surah_ids and surah_id in hint_surah_ids:
                    score += 100

                if score > best_score:
                    best_score = score
                    start_ayah = ayahs_sorted[start_idx]["ayah_id"]
                    end_ayah = ayahs_sorted[end_idx]["ayah_id"]
                    ref_parts = [
                        ayahs_sorted[i]["text"]
                        for i in range(start_idx, end_idx + 1)
                    ]

                    # Calculate confidence based on coverage and match quality
                    confidence = min(1.0, coverage * 0.7 + (actual_matches / trans_token_count) * 0.3)
                    if hint_surah_ids and surah_id in hint_surah_ids:
                        confidence = min(1.0, confidence * 1.15)

                    best_match = {
                        "surah_id": surah_id,
                        "surah_name": ayahs_sorted[start_idx]["surah_name"],
                        "start_ayah": start_ayah,
                        "end_ayah": end_ayah,
                        "reference_text": " ".join(ref_parts),
                        "matched_ayahs": matched_ayahs,
                        "matched_tokens": matched_tokens,
                        "confidence": round(confidence, 4),
                    }

    return best_match


def surah_name_to_id(name: str) -> int | None:
    name = name.strip()
    for i, sname in enumerate(SURAH_NAMES):
        if sname == name:
            return i + 1
    return None
