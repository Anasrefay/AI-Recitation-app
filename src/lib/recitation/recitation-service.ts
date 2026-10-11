/**
 * Quran Recitation AI Service
 * Connects the Frontend exclusively with the Python FastAPI Whisper Quran ASR Backend
 * Model: KheemP/whisper-base-quran-lora
 */

import { PageAyah } from '../quran-verses';
import { extractPageWords, buildRecitationAnalysis, normalizeQuranicArabic, wordSimilarity, isQuranicWordMatch, alignRecitationWords } from './alignment';
import { RecitationAnalysisResponse, LiveStreamChunkResponse, WordMatchStatus, RecitationMistake, RecitationStrictness } from './types';

// Default to Whisper FastAPI Server (KheemP/whisper-base-quran-lora)
const DEFAULT_RECITATION_SERVER_URL = 'http://localhost:8000';
const STORAGE_KEY_RECITATION_URL = 'mushaf_recitation_api_url';

export function getRecitationApiUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_RECITATION_URL);
    if (saved !== null && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  }
  return DEFAULT_RECITATION_SERVER_URL;
}

export function setRecitationApiUrl(url: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_RECITATION_URL, url.trim().replace(/\/+$/, ''));
  }
}

export const saveRecitationApiUrl = setRecitationApiUrl;

/**
 * Health check for the Recitation AI server (Whisper LoRA: KheemP/whisper-base-quran-lora)
 */
export async function checkRecitationServerHealth(customUrl?: string): Promise<{
  isOnline: boolean;
  model?: string;
  device?: string;
  latencyMs?: number;
  message?: string;
}> {
  const baseUrl = (customUrl !== undefined && customUrl.trim().length > 0) 
    ? customUrl.trim().replace(/\/+$/, '') 
    : getRecitationApiUrl();
  const startTime = Date.now();

  try {
    const targetEndpoint = `${baseUrl}/health`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(targetEndpoint, {
      method: 'GET',
      headers: {
        'bypass-tunnel-reminder': 'true'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        isOnline: true,
        model: data.model || 'KheemP/whisper-base-quran-lora',
        device: data.device || 'CUDA / CPU',
        latencyMs: Date.now() - startTime,
        message: data.message || 'سيرفر Whisper متصل وجاهز لتحليل التلاوة ومطابقة الآيات'
      };
    }

    return {
      isOnline: false,
      message: `خطأ في استجابة سيرفر Whisper: رمز الحالة ${res.status}`
    };
  } catch (err: unknown) {
    return {
      isOnline: false,
      message: `تعذر الاتصال بسيرفر Whisper على (${baseUrl}). تأكد من تشغيل ملف recitation_server.py`
    };
  }
}

/**
 * Send full audio recording to the Whisper Quran ASR server (KheemP/whisper-base-quran-lora)
 * Note: Gemini fallback has been completely removed per user request.
 */
export async function analyzeRecitationAudio(
  audioBlob: Blob,
  pageAyahs: PageAyah[],
  pageNumber: number,
  fallbackBrowserTranscription?: string,
  preferredStrictness?: RecitationStrictness
): Promise<RecitationAnalysisResponse> {
  const startTime = Date.now();
  const expectedWords = extractPageWords(pageAyahs);
  const serverUrl = getRecitationApiUrl() || DEFAULT_RECITATION_SERVER_URL;
  const referenceText = pageAyahs.map(a => a.text).join(' ');
  const strictness: RecitationStrictness = preferredStrictness || 
    (typeof window !== 'undefined' ? (localStorage.getItem('mushaf_strictness') as RecitationStrictness) || 'lenient' : 'lenient');

  let recognizedText = '';
  let modelName = 'KheemP/whisper-base-quran-lora';
  let serverMistakes: any[] = [];
  let serverAccuracy: number | null = null;
  let serverErrorMessage: string | null = null;

  // 1. Send audio directly to the dedicated Whisper FastAPI server
  if (serverUrl && (serverUrl.startsWith('http://') || serverUrl.startsWith('https://'))) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recitation.webm');
      formData.append('page_number', String(pageNumber));
      formData.append('reference_text', referenceText);

      const response = await fetch(`${serverUrl}/api/recite/analyze`, {
        method: 'POST',
        headers: {
          'bypass-tunnel-reminder': 'true'
        },
        body: formData,
        signal: AbortSignal.timeout(30000)
      });

      if (response.ok) {
        const data = await response.json();
        let rawTranscription = (data.transcription || data.text || '').trim();
        // Clean special tokens if any (e.g. <|startoftranscript|>, <|notimestamps|>)
        rawTranscription = rawTranscription.replace(/<\|.*?\|>/g, '').trim();
        recognizedText = rawTranscription;
        modelName = data.model || 'KheemP/whisper-base-quran-lora';
        if (Array.isArray(data.mistakes)) {
          serverMistakes = data.mistakes;
        }
        if (typeof data.accuracyScore === 'number') {
          serverAccuracy = data.accuracyScore;
        }
      } else {
        serverErrorMessage = `استجاب سيرفر Whisper بخطأ (رمز ${response.status})`;
      }
    } catch (err: any) {
      console.warn('Whisper server connection error:', err);
      serverErrorMessage = `تعذر الاتصال بسيرفر Whisper على (${serverUrl}). تأكد من تشغيل recitation_server.py`;
    }
  } else {
    serverErrorMessage = 'لم يتم تحديد رابط سيرفر Whisper. يرجى تفعيله في إعدادات ترتيل AI.';
  }

  // 2. Client-side local browser speech recognition fallback (if network is unavailable)
  // NOTE: Absolutely NO fallback to Gemini API!
  if (!recognizedText && fallbackBrowserTranscription && fallbackBrowserTranscription.trim().length > 0) {
    recognizedText = fallbackBrowserTranscription.trim();
    modelName = 'التعرف الصوتي المباشر (المتصفح)';
  }

  const processingMs = Date.now() - startTime;

  // If no speech was recognized at all
  if (!recognizedText) {
    return {
      transcription: '',
      normalizedTranscription: '',
      accuracyScore: 0,
      totalExpectedWords: expectedWords.length,
      matchedWordsCount: 0,
      mistakesCount: 0,
      mistakes: [],
      wordStatuses: {},
      audioDurationSeconds: 0,
      processingTimeMs: processingMs,
      modelName,
      summary: serverErrorMessage || 'لم يتم استلام تفريغ من سيرفر Whisper.'
    };
  }

  // Use alignment engine to compute exact word statuses and mistakes (defaulting to lenient mode)
  const analysis = buildRecitationAnalysis(expectedWords, recognizedText, 0, processingMs, strictness);
  analysis.modelName = modelName;

  if (serverAccuracy !== null) {
    analysis.accuracyScore = serverAccuracy;
  }

  // Filter out any false positive mistakes where expected and spoken words are phonetically or orthographically equivalent
  analysis.mistakes = analysis.mistakes.filter(m => {
    if (m.spokenText && isQuranicWordMatch(m.expectedText, m.spokenText, strictness)) {
      // Find the corresponding word item and ensure its status is marked as 'correct'
      const normExp = normalizeQuranicArabic(m.expectedText);
      const matchedItem = expectedWords.find(ew => ew.cleanText === normExp || ew.text.includes(m.expectedText));
      if (matchedItem) {
        analysis.wordStatuses[matchedItem.id] = { status: 'correct', spoken: m.spokenText };
      }
      return false;
    }
    return true;
  });

  // Re-verify and filter server mistakes if any
  const validServerMistakes = serverMistakes.filter(sm => {
    if (sm.expectedText && sm.spokenText && isQuranicWordMatch(sm.expectedText, sm.spokenText, strictness)) {
      return false;
    }
    return true;
  });

  if (validServerMistakes.length > 0) {
    validServerMistakes.forEach(sm => {
      const match = analysis.mistakes.find(m => 
        (sm.expectedText && m.expectedText.includes(sm.expectedText)) ||
        (sm.spokenText && m.spokenText && m.spokenText.includes(sm.spokenText))
      );
      if (match) {
        if (sm.description) match.description = sm.description;
        if (sm.spokenText) match.spokenText = sm.spokenText;
      }

      if (sm.expectedText) {
        const normExp = normalizeQuranicArabic(sm.expectedText);
        const expItem = expectedWords.find(ew => 
          ew.cleanText === normExp || 
          ew.text.includes(sm.expectedText) || 
          sm.expectedText.includes(ew.text)
        );
        if (expItem) {
          analysis.wordStatuses[expItem.id] = {
            status: sm.type === 'omission' ? 'missing' : 'incorrect',
            spoken: sm.spokenText || ''
          };
        }
      }
    });
  }

  // Update counts and accuracy score based strictly on what was recited
  analysis.mistakesCount = analysis.mistakes.length;
  if (analysis.matchedWordsCount > 0) {
    if (analysis.mistakesCount === 0) {
      analysis.accuracyScore = 100;
    } else {
      const localAcc = Math.round((analysis.matchedWordsCount / (analysis.matchedWordsCount + analysis.mistakesCount)) * 100);
      analysis.accuracyScore = serverAccuracy !== null && serverAccuracy > 0
        ? Math.max(serverAccuracy, localAcc)
        : localAcc;
    }
  } else if (serverAccuracy !== null) {
    analysis.accuracyScore = serverAccuracy;
  }

  analysis.matchedWordIds = Object.keys(analysis.wordStatuses).filter(
    id => analysis.wordStatuses[id].status === 'correct' || analysis.wordStatuses[id].status === 'live_active'
  );

  return analysis;
}

/**
 * Send real-time audio chunk (live streaming) for progressive word recognition while reciting
 */
export async function analyzeLiveAudioChunk(
  chunkBlob: Blob,
  pageAyahs: PageAyah[]
): Promise<LiveStreamChunkResponse> {
  const serverUrl = getRecitationApiUrl();
  const expectedWords = extractPageWords(pageAyahs);

  const formData = new FormData();
  formData.append('audio', chunkBlob, 'chunk.webm');
  formData.append('reference_text', pageAyahs.map(a => a.text).join(' '));

  try {
    const response = await fetch(`${serverUrl}/api/recite/stream-chunk`, {
      method: 'POST',
      headers: {
        'bypass-tunnel-reminder': 'true'
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const data = await response.json();
    const partialText = data.transcription || '';
    
    // Match spoken tokens to expected words anywhere on the page using the alignment engine
    const alignment = alignRecitationWords(expectedWords, partialText, 'lenient');
    const matchedIds = Object.keys(alignment.wordStatuses).filter(
      id => alignment.wordStatuses[id].status === 'correct' || alignment.wordStatuses[id].status === 'live_active'
    );

    return {
      partialTranscription: partialText,
      matchedWordIds: matchedIds
    };
  } catch (err) {
    return {
      partialTranscription: '',
      matchedWordIds: []
    };
  }
}

/**
 * Complete Python FastAPI backend source code for the user to run in Colab or Local Server.
 */
export const PYTHON_WHISPER_FASTAPI_SERVER_CODE = `# ==============================================================================
# سيرفر FastAPI لتشغيل موديل Whisper المخصص للقرآن الكريم (HuggingFace)
# Model: KheemP/whisper-base-quran-lora (LoRA Fine-tuned on Quran Ayahs)
# ==============================================================================

# التثبيت (انسخ هذا السطر في الطرفية أو أول خلية وتشغيله):
# !pip install -q fastapi uvicorn pydantic python-multipart torch transformers peft accelerate soundfile librosa

import os
import tempfile
import subprocess
import traceback
import torch
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
from peft import PeftModel, PeftConfig

app = FastAPI(
    title="Quran Recitation Whisper AI API",
    description="سيرفر التعرف على تلاوة القرآن الكريم ومقارنتها بالرسم العثماني",
    version="1.3.0"
)

# تفعيل الـ CORS للاتصال بالفرونت إند من أي مصدر
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------------------
# تحميل موديل Whisper LoRA للقرآن الكريم: KheemP/whisper-base-quran-lora
# ------------------------------------------------------------------------------
MODEL_ID = "KheemP/whisper-base-quran-lora"
device = "cuda:0" if torch.cuda.is_available() else "cpu"
torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

print(f"🚀 جاري تحميل موديل القرآن الكريم ({MODEL_ID}) على: {device}...")

peft_config = PeftConfig.from_pretrained(MODEL_ID)
base_model_name = peft_config.base_model_name_or_path or "tarteel-ai/whisper-base-ar-quran"

processor = AutoProcessor.from_pretrained(base_model_name)
base_model = AutoModelForSpeechSeq2Seq.from_pretrained(
    base_model_name,
    torch_dtype=torch_dtype,
    low_cpu_mem_usage=True
).to(device)

model = PeftModel.from_pretrained(base_model, MODEL_ID)

pipe = pipeline(
    "automatic-speech-recognition",
    model=model,
    tokenizer=processor.tokenizer,
    feature_extractor=processor.feature_extractor,
    torch_dtype=torch_dtype,
    chunk_length_s=30,
    stride_length_s=5
)

print("✅ تم تجهيز موديل القرآن الكريم بنجاح (KheemP/whisper-base-quran-lora)!")

# ------------------------------------------------------------------------------
# دالة تحويل الصوت الآمنة
# ------------------------------------------------------------------------------
def process_audio_file(input_path: str) -> str:
    """تحويل أي ملف صوتي لـ 16kHz mono WAV لتمريره لـ Whisper"""
    output_path = input_path + "_16k.wav"
    try:
        cmd = [
            "ffmpeg", "-y", "-i", input_path,
            "-ar", "16000",
            "-ac", "1",
            "-c:a", "pcm_s16le",
            output_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if res.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 100:
            return output_path
    except Exception as e:
        print(f"⚠️ تحذير ffmpeg: {e}")
    # إذا فشل ffmpeg نستخدم الملف الأصلي مباشرة
    return input_path

# ------------------------------------------------------------------------------
# مسارات السيرفر (Endpoints)
# ------------------------------------------------------------------------------
@app.get("/")
@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_ID,
        "device": device,
        "message": "خادم تلاوة القرآن جاهز للعمل"
    }

@app.post("/api/recite/analyze")
async def analyze_recitation(
    audio: UploadFile = File(...),
    page_number: int = Form(1),
    reference_text: str = Form("")
):
    """
    استقبال الصوت الكامل من المتصفح، تحويله لـ 16kHz wav، وتمريره لموديل Whisper
    """
    input_path = None
    output_path = None
    try:
        audio_bytes = await audio.read()
        if not audio_bytes or len(audio_bytes) < 100:
            return {"status": "success", "transcription": "", "page_number": page_number}

        suffix = os.path.splitext(audio.filename or "")[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_in:
            temp_in.write(audio_bytes)
            input_path = temp_in.name

        # معالجة الصوت
        target_audio_file = process_audio_file(input_path)
        output_path = target_audio_file if target_audio_file != input_path else None

        print(f"🎙️ تم استقبال تسجيل صوتي بحجم {len(audio_bytes)} بايت للصفحة {page_number}...")

        # تشغيل Whisper ASR مع دعم العربية ومراعاة بسملة الفاتحة
        try:
            gen_kwargs = {"task": "transcribe", "language": "arabic"}
            if page_number == 1 or "الفاتحة" in reference_text:
                gen_kwargs["initial_prompt"] = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ"
            result = pipe(
                target_audio_file,
                generate_kwargs=gen_kwargs
            )
        except Exception:
            # محاولة ثانية بدون generate_kwargs إذا كانت نسخة transformers تطلب ذلك
            result = pipe(target_audio_file)

        raw_transcription = result.get("text", "").strip()
        # تنظيف الرموز الخاصة مثل <|startoftranscript|> وغيرها
        import re
        transcription = re.sub(r'<\|.*?\|>', '', raw_transcription).strip()

        print(f"✨ النص المستخرج (نقي): {transcription}")

        return {
            "status": "success",
            "transcription": transcription,
            "page_number": page_number,
            "model": MODEL_ID
        }

    except Exception as e:
        print("❌ خطأ أثناء معالجة التلاوة:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        for p in [input_path, output_path]:
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass

# ------------------------------------------------------------------------------
# تشغيل السيرفر مباشرة (Localhost أو سيرفر منفصل):
# ------------------------------------------------------------------------------
# للتشغيل من الطرفية:
# uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# أو للتشغيل المباشر داخل كود بايثون:
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
`;

export function getRecitationWhisperPythonCode(): string {
  return PYTHON_WHISPER_FASTAPI_SERVER_CODE;
}
