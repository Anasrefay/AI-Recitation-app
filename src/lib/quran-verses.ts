/**
 * Quran Verses Service
 * Fetches, caches (Memory + IndexedDB), and organizes verses per page for the Madinah Mushaf.
 */

export interface PageAyah {
  number: number;
  numberInSurah: number;
  text: string;
  surahNumber: number;
  surahName: string;
  juzNumber: number;
  hizbQuarter: number;
  sajda: boolean | object;
}

export interface PageVersesData {
  pageNumber: number;
  ayahs: PageAyah[];
  surahs: Array<{
    number: number;
    name: string;
    startAyahIndex: number;
  }>;
}

// In-memory cache
const memoryCache = new Map<number, PageVersesData>();

// Simple IndexedDB Cache for Offline Quran Text
const DB_NAME = 'MadinahMushafVersesDB_v4';
const STORE_NAME = 'page_verses';

/**
 * Remove leading Basmala from an ayah text (handles Uthmani wasla ٱ and all Arabic script variants)
 * safely without eating into the verse content.
 */
export function removeLeadingBasmala(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();

  // Known exact Uthmani and simple Basmala prefixes
  const knownPrefixes = [
    'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
    'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    'بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ',
    'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    'بِسْمِ اللهِ الرَّحْمنِ الرَّحِيمِ',
    'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
    'بسم الله الرحمن الرحيم'
  ];

  for (const prefix of knownPrefixes) {
    if (trimmed.startsWith(prefix)) {
      const remaining = trimmed.slice(prefix.length).trim();
      if (remaining.length > 0) {
        return remaining;
      }
    }
  }

  // Regex fallback: precisely matches only the 4 words: (بسم) (الله) (الرحمن) (الرحيم)
  const exactBasmalaRegex = /^بِ?سْمِ?\s+[ٱا]?للَّ?ـ?ٰ?هِ?\s+[ٱا]?لرَّ?حْ?مَ?ـ?ٰ?نِ?\s+[ٱا]?لرَّ?حِ?ي?مِ?\s+/u;
  const match = trimmed.match(exactBasmalaRegex);
  if (match && match[0]) {
    const after = trimmed.slice(match[0].length).trim();
    if (after.length > 0) {
      return after;
    }
  }

  return trimmed;
}

function openVersesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'pageNumber' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getCachedPageVerses(pageNumber: number): Promise<PageVersesData | null> {
  try {
    const db = await openVersesDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(pageNumber);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function savePageVersesToCache(data: PageVersesData): Promise<void> {
  try {
    const db = await openVersesDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(data);
  } catch {
    // ignore
  }
}

/**
 * Fetch verses of a specific Quran page
 */
export async function getPageVerses(pageNumber: number): Promise<PageVersesData> {
  const clampedPage = Math.max(1, Math.min(604, pageNumber));

  // 1. Check in-memory cache
  if (memoryCache.has(clampedPage)) {
    return memoryCache.get(clampedPage)!;
  }

  // 2. Check IndexedDB cache
  const cached = await getCachedPageVerses(clampedPage);
  if (cached) {
    memoryCache.set(clampedPage, cached);
    return cached;
  }

  // 3. Fetch from AlQuran Cloud API (Uthmani edition)
  try {
    const res = await fetch(`https://api.alquran.cloud/v1/page/${clampedPage}/quran-uthmani`);
    if (!res.ok) {
      throw new Error(`Failed to fetch page verses: ${res.status}`);
    }
    const json = await res.json();
    if (json.code !== 200 || !json.data || !json.data.ayahs) {
      throw new Error('Invalid response structure from Quran API');
    }

    const rawAyahs = json.data.ayahs;
    const ayahs: PageAyah[] = [];
    const surahsMap = new Map<number, { number: number; name: string; startAyahIndex: number }>();

    rawAyahs.forEach((a: any, idx: number) => {
      const surahNum = a.surah?.number || 1;
      const surahName = a.surah?.name || '';
      
      if (!surahsMap.has(surahNum)) {
        surahsMap.set(surahNum, {
          number: surahNum,
          name: surahName,
          startAyahIndex: idx
        });
      }

      let ayahText = a.text || '';
      
      // Clean leading Basmala from Ayah 1 of any surah except Al-Fatiha (Surah 1)
      if (a.numberInSurah === 1 && surahNum !== 1 && surahNum !== 9) {
        ayahText = removeLeadingBasmala(ayahText);
      }

      ayahs.push({
        number: a.number,
        numberInSurah: a.numberInSurah,
        text: ayahText,
        surahNumber: surahNum,
        surahName: surahName,
        juzNumber: a.juz,
        hizbQuarter: a.hizbQuarter,
        sajda: a.sajda
      });
    });

    const result: PageVersesData = {
      pageNumber: clampedPage,
      ayahs,
      surahs: Array.from(surahsMap.values())
    };

    // Store in caches
    memoryCache.set(clampedPage, result);
    savePageVersesToCache(result);

    return result;
  } catch (error) {
    console.error('Error loading page verses:', error);
    throw error;
  }
}
