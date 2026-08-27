export interface AyahErrorDetail {
  ayah_number: number;
  reference_text: string;
  recited_text: string;
  status: 'correct' | 'warning' | 'error' | 'missing';
  errors: Array<{
    type: 'substitution' | 'missing' | 'extra';
    expected?: string;
    actual?: string;
    message: string;
  }>;
  ayah_wer: number | null;
  ayah_cer: number | null;
}

export interface RecitationAnalysis {
  page: number;
  transcription: string;
  reference: string;
  wer: number | null;
  cer: number | null;
  accuracy: number;
  confidence: number;
  model: string;
  device: string;
  detected: boolean;
  detected_surah_number: number | null;
  detected_surah_name: string | null;
  detected_start_ayah: number | null;
  detected_end_ayah: number | null;
  ayah_errors: AyahErrorDetail[];
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/$/, '');

function getExtension(mimeType: string): string {
  const mime = mimeType.toLowerCase();

  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('flac')) return 'flac';

  return 'webm';
}

export async function analyzeRecitation(
  audio: Blob,
  page: number,
): Promise<RecitationAnalysis> {
  const form = new FormData();

  form.append('page', String(page));
  form.append(
    'audio',
    audio,
    `recitation-${page}.${getExtension(audio.type)}`,
  );

  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/v1/recitations/analyze`,
      {
        method: 'POST',
        body: form,
      },
    );
  } catch {
    throw new Error(
      'تعذر الاتصال بخادم تحليل التلاوة. تأكد من تشغيل الـ API واتصال الإنترنت.',
    );
  }

  if (!response.ok) {
    let message = 'تعذر تحليل التلاوة';

    try {
      const payload = await response.json();
      if (typeof payload?.detail === 'string') {
        message = payload.detail;
      }
    } catch {
      // Ignore malformed error responses.
    }

    throw new Error(message);
  }

  return response.json();
}
