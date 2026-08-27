# مصحف المدينة الرقمي — AI Quran Recitation App

تطبيق ويب تقدمي (PWA) لقراءة القرآن الكريم بالرسم العثماني برواية حفص عن عاصم (طبعة مصحف المدينة المنورة - 604 صفحات)، مع تحليل ذكي للتلاوة باستخدام الذكاء الاصطناعي.

---

## المميزات الرئيسية

1. **عرض صفحات المصحف الشريف** — مطابق 100% للمصحف المطبوع بالمدينة المنورة (604 صفحة كاملة)، مع إبراز رأس الصفحة وأسفلها، ودعم صفحة واحدة أو صفحتين متقابلتين.

2. **تسجيل التلاوة وتحليلها بالذكاء الاصطناعي** — تسجيل تلاوة القارئ الشخصية لكل صفحة، ثم تحليلها عبر نموذج Whisper Large v3 Turbo على Hugging Face Inference Providers. يستخرج النص، يقارنه بنص الآيات في الصفحة، ويعرض:
   - نسبة التطابق (Accuracy) ونسبة الخطأ (WER/CER)
   - تفصيل لكل آية: صحيحة / تحذير / خطأ / ناقصة
   - نوع الخطأ: تعويض / حذف / إضافة مع النص المتوقع والمنطوق

3. **كشف الآيات المُتلوة (Live Transcription)** — أثناء التسجيل، تُرسل مقاطع صوتية كل 3 ثوانٍ عبر WebSocket إلى الخادم للحصول على ترجمة عربية فورية، مما يسمح للتطبيق بعرض الآية التي يقرأها القارئ حالياً.

4. **تفسير كل آية** — اضغط على أي آية في نتائج التحليل لفتح نافذة تفسير القرطبي.

5. **تنقل سلس** — سحب باللمس لليمين واليسار (RTL)، أزرار التنقل السريع، شريط تمرير لجميع الصفحات، فهرس سور متكامل مع بحث فوري يتجاهل التشكيل والهمزات، فهرس الأجزاء.

6. **أنماط المظهر** — الوضع النهاري (العاجي)، الوضع الداكن الدافئ (Sepia)، الوضع الليلي (Dark Mode).

7. **حفظ التسجيلات محلياً** — جميع التسجيلات مخزنة في IndexedDB في المتصفح، لا تُرسل لأي خادم.

---

## البنية التقنية

```text
┌─────────────────────────────────────────────────────────┐
│  Frontend (React 19 + Vite + TailwindCSS 4)             │
│  ┌──────────────┐  ┌──────────────────────────────────┐ │
│  │ Mushaf Pages  │  │ RecordingBar                     │ │
│  │ (CDN images)  │  │  ├─ mediaRecorder (3s chunks)   │ │
│  │               │  │  │   └→ WebSocket → Live ASR     │ │
│  │               │  │  └─ fullRecorder (continuous)    │ │
│  │               │  │       └→ POST /api/v1/analyze    │ │
│  │               │  │       └→ POST /api/v1/tafsir     │ │
│  └──────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
         │                                      │
         │  http://localhost:8000                │  WebSocket
         ▼                                      ▼
┌─────────────────────────────────────────────────────────┐
│  Backend (FastAPI + Python)                             │
│  ┌────────────────────────────────────────────────────┐ │
│  │ POST /api/v1/recitations/analyze                   │ │
│  │   └→ HuggingFace ASR (aiohttp → JSON+base64)      │ │
│  │   └→ Verse detection (quran.py)                    │ │
│  │   └→ WER/CER + per-ayah error analysis             │ │
│  ├────────────────────────────────────────────────────┤ │
│  │ WebSocket /ws/live-transcribe                      │ │
│  │   └→ process_live_chunk() → HuggingFace ASR        │ │
│  ├────────────────────────────────────────────────────┤ │
│  │ GET /api/v1/tafsir/{surah}/{ayah}                  │ │
│  │   └→ Tafsir al-Qurtubi (local JSON)                │ │
│  └────────────────────────────────────────────────────┘ │
│  Data files (at project root):                          │
│    quran_data.json  (114 surahs + verses)               │
│    ar-tafsir-qurtubi.json  (~19MB tafsir data)          │
└─────────────────────────────────────────────────────────┘
         │
         │  Bearer HF_TOKEN
         ▼
┌─────────────────────────────────────────────────────────┐
│  Hugging Face Inference Providers (serverless)          │
│  Model: openai/whisper-large-v3-turbo                   │
└─────────────────────────────────────────────────────────┘
```

### حزمة الواجهة الأمامية (Frontend)

| المكتبة | الإصدار | الاستخدام |
|---------|---------|----------|
| React | 19.x | بناء الواجهة |
| TypeScript | 5.8 | التحقق من الأنواع |
| Vite | 6.x | بناء وتطوير |
| TailwindCSS | 4.x | التنسيق |
| lucide-react | 0.546 | الأيقونات |

### حزمة الخادم (Backend)

| المكتبة | الاستخدام |
|---------|----------|
| FastAPI 0.116 | بناء الـ API |
| uvicorn 0.35 | تشغيل الخادم |
| huggingface_hub >=0.25 | إدارة التوكن والتحقق من الهوية (لا يُستخدم للـ ASR مباشرة) |
| aiohttp >=3.9 | استدعاء HF ASR مباشرة (JSON+base64) |
| jiwer >=3.0 | حساب WER/CER |
| pydantic-settings | إدارة المتغيرات البيئية |

---

## المتطلبات

- **Node.js** ≥ 18 + npm
- **Python** ≥ 3.11
- **HuggingFace Token** — حساب مجاني على [huggingface.co](https://huggingface.co) + توكن API (للقراءة فقط)
- **Docker + Docker Compose** (اختياري — للتشغيل كحاوية)

---

## التشغيل محلياً (بدون Docker)

### 1. الخادم (Backend)

```powershell
cd backend

# إنشاء بيئة افتراضية
python -m venv .venv
.\.venv\Scripts\activate          # Windows
# source .venv/bin/activate        # Linux/macOS

# تثبيت الاعتماديات
pip install -r requirements.txt

# إعداد المتغيرات البيئية
copy .env.example .env
# افتح .env وضع HF_TOKEN=hf_xxxxxxxxxxxxxxx
```

```powershell
# تشغيل الخادم
uvicorn app.main:app --reload --port 8000
```

الـ API docs ستكون على: `http://127.0.0.1:8000/docs`

### 2. الواجهة الأمامية (Frontend)

```powershell
# من جذر المشروع
npm install
npm run dev
```

التطبيق سيكون على: `http://localhost:3000`

### متغيرات الواجهة الأمامية

أنشئ ملف `.env` في جذر المشروع:

```env
VITE_API_BASE_URL=http://localhost:8000
```

> لا تضع HF_TOKEN هنا أبداً. الـ token خاص بالخادم فقط.

---

## التشغيل عبر Docker (موصى به)

### متغيرات بيئة Docker

تُمرر من بيئة shell النظام (ليس من ملف `.env`) — اضبطها قبل التشغيل:

```powershell
# Windows PowerShell
$env:HF_TOKEN = "hf_xxxxxxxxxxxxxxxxx"
$env:HF_MODEL_ID = "openai/whisper-large-v3-turbo"
$env:HF_PROVIDER = "hf-inference"
```

```bash
# Linux/macOS
export HF_TOKEN="hf_xxxxxxxxxxxxxxxxx"
export HF_MODEL_ID="openai/whisper-large-v3-turbo"
export HF_PROVIDER="hf-inference"
```

### التشغيل

```powershell
docker compose up --build
```

| الخدمة | الرابط |
|--------|--------|
| التطبيق (Frontend) | `http://localhost:8080` |
| الـ API (Backend) | `http://localhost:8000` |
| وصف الـ API | `http://localhost:8000/docs` |
| فحص صحة الخادم | `http://localhost:8000/health` |

---

## جدول المتغيرات البيئية (Environment Variables)

### الخادم (backend/.env)

| المتغير | القيمة الافتراضية | الوصف |
|---------|-------------------|-------|
| `HF_TOKEN` | *(مطلوب)* | توكن HuggingFace API للقراءة فقط |
| `HF_MODEL_ID` | `openai/whisper-large-v3-turbo` | نموذج Whisper المستخدم |
| `HF_PROVIDER` | `hf-inference` | مزود الاستضافة |
| `HF_TIMEOUT_SECONDS` | `30` | مهلة انتظار استدعاء HF ASR بالثواني |
| `MAX_AUDIO_MB` | `25` | الحد الأقصى لحجم الملف الصوتي بالميجابايت |
| `CORS_ORIGINS` | `http://localhost:3000` | أصول CORS المسموح بها |
| `APP_ENV` | `development` | بيئة التشغيل |

### الواجهة الأمامية (.env في الجذر)

| المتغير | القيمة الافتراضية | الوصف |
|---------|-------------------|-------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | رابط الخادم الخلفي |

---

## هيكل المشروع

```
.
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry — endpoints + WebSocket handler
│   │   ├── huggingface.py       # aiohttp direct POST → HF ASR (JSON+base64)
│   │   ├── live.py              # Stateless process_live_chunk() for WebSocket
│   │   ├── quran.py             # Arabic normalization, Uthmani expansions, detect_verse_range()
│   │   ├── tafsir.py            # Tafsir al-Qurtubi loader
│   │   ├── schemas.py           # Pydantic models (AnalysisResponse, AyahErrorDetail, etc.)
│   │   └── config.py            # Settings via pydantic-settings
│   ├── .env                     # Server secrets (HF_TOKEN etc.)
│   ├── .env.example             # Template
│   ├── Dockerfile               # Python 3.12 slim + data files at / root
│   └── requirements.txt
├── src/
│   ├── components/
│   │   ├── Header/              # AppHeader, QuranAiLogo
│   │   ├── MushafPage/          # MushafContainer, PageViewer
│   │   ├── Recording/           # RecordingBar (connects to live transcription + full recorder)
│   │   ├── Tafsir/              # TafsirModal
│   │   ├── Navigation/          # IndexModal (surah/juz picker)
│   │   └── Settings/            # SettingsModal
│   ├── lib/
│   │   ├── recording/
│   │   │   ├── recorder.ts      # Two parallel MediaRecorders (live 3s + full continuous)
│   │   │   ├── storage.ts       # IndexedDB persistence
│   │   │   └── types.ts         # RecorderOptions, VoiceRecording types
│   │   ├── ai-recitation.ts     # POST /api/v1/recitations/analyze client
│   │   ├── live-transcription.ts # WebSocket client for live verse detection
│   │   ├── tafsir-api.ts        # GET /api/v1/tafsir/{surah}/{ayah} client
│   │   ├── quran-data.ts        # Quran data facade + CDN image URLs
│   │   └── quran-verses.ts      # Fetch/cache page verses from AlQuran Cloud API
│   ├── data/                    # surahs.ts, juz.ts, pages-metadata.ts
│   ├── App.tsx                  # Root component
│   └── main.tsx                 # Entry point
├── public/
│   ├── manifest.json            # PWA manifest
│   ├── sw.js                    # Service worker
│   └── icon.svg                 # App icon
├── quran_data.json              # 114 surahs with verses (used by backend)
├── ar-tafsir-qurtubi.json       # Tafsir al-Qurtubi data (~19MB)
├── model/
│   └── model.ipynb              # Data preparation notebook (Colab)
├── tafsir/
│   └── tafsir.ipynb             # Tafsir data preparation notebook (Colab)
├── nginx.conf                   # SPA + /api/ + /ws/ WebSocket proxy
├── Dockerfile.frontend          # Multi-stage: node:22 build → nginx:alpine
├── docker-compose.yml           # api (port 8000) + web (port 8080)
├── vite.config.ts               # Vite config with @ alias
├── tsconfig.json                # TypeScript config
├── package.json                 # Frontend dependencies
└── .dockerignore
```

---

## ملاحظات تقنية مهمة

### نموذج الذكاء الاصطناعي

الخادم يستخدم Hugging Face Inference Providers مباشرة عبر `aiohttp` (لا يمر عبر `huggingface_hub` للـ ASR) مع:

- **JSON + base64** format (وليس multipart — مزود `hf-inference` لا يدعم multipart للـ ASR)
- **`language: "ar"`** داخل `generation_parameters` لإجبار الإخراج بالعربية

### تسجيل الصوت في الواجهة الأمامية

```
mediaRecorder (يُعاد تشغيله كل 3 ثوانٍ)
  → chunks صحيحة (WebM مفردة) → WebSocket → Live ASR

fullRecorder (تسجيل مستمر)
  → ملف WebM واحد → POST /analyze (للحفظ/التشغيل/التحليل)
```

تم فصل التسجيلين لتجنب مشكلة تلوث WebM containers عند دمج عدة ملفات WebM مفردة.

### Python f-string syntax

Python 3.12+ فقط يسمح استخدام علامات اقتباس مزدوجة داخل f-strings مزدوجة الاقتباس. داخل `main.py`، يتم استخدام فواصل مفردة للـ `.join()` داخل f-strings.

---

## استكشاف الأخطاء وإصلاحها (Troubleshooting)

| المشكلة | الحل |
|---------|------|
| **415 Unsupported Media Type** | تأكد أن الامتداد `.webm` ونوع MIME `audio/webm` مدعومان. قد تحتاج `mimetypes.add_type()` في Windows. |
| **HF 400 Bad Request** | لا تستخدم `extra_body` مع ASR عبر `hf-inference`. استخدم `aiohttp` مباشرة مع JSON+base64. |
| **HF timeout** | زد `HF_TIMEOUT_SECONDS` أو استخدم نموذج أصغر (`openai/whisper-large-v3`). |
| **WebSocket لا يتصل** | تأكد أن `nginx.conf` يحتوي `location /ws/` مع Upgrade headers. تحقق من `VITE_API_BASE_URL`. |
| **ملفات البيانات (data files) غير موجودة** | في Docker، يجب أن تكون `quran_data.json` و `ar-tafsir-qurtubi.json` في `/` (الجذر) وليس `/app/`. |
| **Live transcription توقف بعد ~3 ثوانٍ** | تأكد أن `mediaRecorder` يُعاد تشغيله بعد كل chunk وأن الـ WebM header لا يُقص. |

---

## ملاحظات للإنتاج

- **لا تكشف HF_TOKEN في الكود الأمامي أبداً** — خاصة بالخادم فقط.
- **أضف مصادقة وتحديد معدل** قبل نشر `/api/v1/recitations/analyze` للعامة.
- **استخدم HTTPS** في بيئة الإنتاج الحقيقية.
- **WER/CER** يقيس التشابه في الترجمة — ليست نتيجة تجويد كاملة.
- **إصدار huggingface_hub** — تأكد أنه ≥0.25 لدعم `AsyncInferenceClient`.

---

## رخصة الاستخدام

تطبيق مصحف المدينة متاح كوقف رقمي ومفتوح المصدر لخدمة كتاب الله والقراء.
