const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/$/, '');

export interface TafsirData {
  surah_number: number;
  ayah_number: number;
  tafsir: string;
  source: string;
}

export async function fetchAyahTafsir(
  surahNumber: number,
  ayahNumber: number,
): Promise<TafsirData> {
  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/v1/tafsir/${surahNumber}/${ayahNumber}`,
    );
  } catch {
    throw new Error('تعذر الاتصال بخادم التفسير. تأكد من تشغيل الـ API.');
  }

  if (!response.ok) {
    let message = 'تعذر تحميل التفسير';
    try {
      const payload = await response.json();
      if (typeof payload?.detail === 'string') {
        message = payload.detail;
      }
    } catch {
      // Ignore
    }
    throw new Error(message);
  }

  return response.json();
}
