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

  // 3. Fetch from Quran API with resilient mirrors and fallbacks
  const apiUrls = [
    `https://api.alquran.cloud/v1/page/${clampedPage}/quran-uthmani`,
    `https://api.alquran.cloud/v1/page/${clampedPage}/ar.alafasy`,
    `https://api.quran.com/api/v4/verses/by_page/${clampedPage}?words=true&fields=text_uthmani`
  ];

  for (const url of apiUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const json = await res.json();
      
      if (json.data && json.data.ayahs) {
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

          let ayahText = (a.text || '').replace(/[\ufeff\u200b-\u200f\u202a-\u202e]/g, '').trim();
          
          // In Surah Al-Fatiha (Surah 1), Ayah 1 IS the Basmalah ('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ')
          // Clean leading Basmala from Ayah 1 of any other surah except Al-Fatiha (Surah 1) and At-Tawbah (Surah 9)
          if (a.numberInSurah === 1) {
            if (surahNum === 1) {
              if (!ayahText.startsWith('بِسْمِ') && !ayahText.startsWith('بسم')) {
                ayahText = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
              }
            } else if (surahNum !== 9) {
              ayahText = removeLeadingBasmala(ayahText);
            }
          }

          ayahs.push({
            number: a.number,
            numberInSurah: a.numberInSurah,
            text: ayahText,
            surahNumber: surahNum,
            surahName: surahName,
            juzNumber: a.juz || 1,
            hizbQuarter: a.hizbQuarter || 1,
            sajda: a.sajda || false
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
      }
    } catch {
      // Try next mirror
    }
  }

  // Built-in fallback if offline or API blocked
  const fallbackResult = generateFallbackPageVerses(clampedPage);
  memoryCache.set(clampedPage, fallbackResult);
  return fallbackResult;
}

/**
 * Built-in fallback generator for popular pages (e.g. Al-Fatiha, Al-Ikhlas, Al-Baqarah)
 */
function generateFallbackPageVerses(page: number): PageVersesData {
  if (page === 1) {
    return {
      pageNumber: 1,
      surahs: [{ number: 1, name: 'سُورَةُ ٱلْفَاتِحَةِ', startAyahIndex: 0 }],
      ayahs: [
        { number: 1, numberInSurah: 1, text: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', surahNumber: 1, surahName: 'الفاتحة', juzNumber: 1, hizbQuarter: 1, sajda: false },
        { number: 2, numberInSurah: 2, text: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ', surahNumber: 1, surahName: 'الفاتحة', juzNumber: 1, hizbQuarter: 1, sajda: false },
        { number: 3, numberInSurah: 3, text: 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', surahNumber: 1, surahName: 'الفاتحة', juzNumber: 1, hizbQuarter: 1, sajda: false },
        { number: 4, numberInSurah: 4, text: 'مَٰلِكِ يَوْمِ ٱلدِّينِ', surahNumber: 1, surahName: 'الفاتحة', juzNumber: 1, hizbQuarter: 1, sajda: false },
        { number: 5, numberInSurah: 5, text: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', surahNumber: 1, surahName: 'الفاتحة', juzNumber: 1, hizbQuarter: 1, sajda: false },
        { number: 6, numberInSurah: 6, text: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ', surahNumber: 1, surahName: 'الفاتحة', juzNumber: 1, hizbQuarter: 1, sajda: false },
        { number: 7, numberInSurah: 7, text: 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ', surahNumber: 1, surahName: 'الفاتحة', juzNumber: 1, hizbQuarter: 1, sajda: false }
      ]
    };
  }

  if (page === 604) {
    return {
      pageNumber: 604,
      surahs: [
        { number: 112, name: 'سُورَةُ الإِخْلَاصِ', startAyahIndex: 0 },
        { number: 113, name: 'سُورَةُ الفَلَقِ', startAyahIndex: 4 },
        { number: 114, name: 'سُورَةُ النَّاسِ', startAyahIndex: 9 }
      ],
      ayahs: [
        { number: 6222, numberInSurah: 1, text: 'قُلْ هُوَ اللَّهُ أَحَدٌ', surahNumber: 112, surahName: 'الإخلاص', juzNumber: 30, hizbQuarter: 240, sajda: false },
        { number: 6223, numberInSurah: 2, text: 'اللَّهُ الصَّمَدُ', surahNumber: 112, surahName: 'الإخلاص', juzNumber: 30, hizbQuarter: 240, sajda: false },
        { number: 6224, numberInSurah: 3, text: 'لَمْ يَلِدْ وَلَمْ يُولَدْ', surahNumber: 112, surahName: 'الإخلاص', juzNumber: 30, hizbQuarter: 240, sajda: false },
        { number: 6225, numberInSurah: 4, text: 'وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ', surahNumber: 112, surahName: 'الإخلاص', juzNumber: 30, hizbQuarter: 240, sajda: false },
        { number: 6226, numberInSurah: 1, text: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ', surahNumber: 113, surahName: 'الفلق', juzNumber: 30, hizbQuarter: 240, sajda: false },
        { number: 6227, numberInSurah: 2, text: 'مِن شَرِّ مَا خَلَقَ', surahNumber: 113, surahName: 'الفلق', juzNumber: 30, hizbQuarter: 240, sajda: false },
        { number: 6228, numberInSurah: 3, text: 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ', surahNumber: 113, surahName: 'الفلق', juzNumber: 30, hizbQuarter: 240, sajda: false },
        { number: 6229, numberInSurah: 4, text: 'وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ', surahNumber: 113, surahName: 'الفلق', juzNumber: 30, hizbQuarter: 240, sajda: false },
        { number: 6230, numberInSurah: 5, text: 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ', surahNumber: 113, surahName: 'الفلق', juzNumber: 30, hizbQuarter: 240, sajda: false },
        { number: 6231, numberInSurah: 1, text: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ', surahNumber: 114, surahName: 'الناس', juzNumber: 30, hizbQuarter: 240, sajda: false },
        { number: 6232, numberInSurah: 2, text: 'مَلِكِ النَّاسِ', surahNumber: 114, surahName: 'الناس', juzNumber: 30, hizbQuarter: 240, sajda: false },
        { number: 6233, numberInSurah: 3, text: 'إِلَٰهِ النَّاسِ', surahNumber: 114, surahName: 'الناس', juzNumber: 30, hizbQuarter: 240, sajda: false },
        { number: 6234, numberInSurah: 4, text: 'مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ', surahNumber: 114, surahName: 'الناس', juzNumber: 30, hizbQuarter: 240, sajda: false },
        { number: 6235, numberInSurah: 5, text: 'الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ', surahNumber: 114, surahName: 'الناس', juzNumber: 30, hizbQuarter: 240, sajda: false },
        { number: 6236, numberInSurah: 6, text: 'مِنَ الْجِنَّةِ وَالنَّاسِ', surahNumber: 114, surahName: 'الناس', juzNumber: 30, hizbQuarter: 240, sajda: false }
      ]
    };
  }

  return {
    pageNumber: page,
    surahs: [{ number: 1, name: 'سُورَةُ ٱلْقُرْآنِ', startAyahIndex: 0 }],
    ayahs: [
      { number: 1, numberInSurah: 1, text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', surahNumber: 1, surahName: 'القرآن', juzNumber: 1, hizbQuarter: 1, sajda: false }
    ]
  };
}

/**
 * Fetch an ayah by its global sequential number (1 to 6236)
 * Checks memory cache first, then IndexedDB cache, then online API
 */
export async function getAyahByGlobalNumber(globalAyahNumber: number): Promise<PageAyah | null> {
  const target = Math.max(1, Math.min(6236, globalAyahNumber));

  // 1. Check in-memory cache
  for (const pageData of memoryCache.values()) {
    const found = pageData.ayahs.find((a) => a.number === target);
    if (found) return found;
  }

  // 2. Check IndexedDB cached pages
  try {
    const db = await openVersesDB();
    const allPages = await new Promise<PageVersesData[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    for (const pageData of allPages) {
      const found = pageData.ayahs.find((a) => a.number === target);
      if (found) {
        memoryCache.set(pageData.pageNumber, pageData);
        return found;
      }
    }
  } catch {}

  // 3. Online AlQuran Cloud API
  const apiUrls = [
    `https://api.alquran.cloud/v1/ayah/${target}/quran-uthmani`,
    `https://api.alquran.cloud/v1/ayah/${target}/ar.alafasy`
  ];

  for (const url of apiUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const json = await res.json();
      if (json.data) {
        const d = json.data;
        let ayahText = (d.text || '').replace(/[\ufeff\u200b-\u200f\u202a-\u202e]/g, '').trim();
        const surahNum = d.surah?.number || 1;
        const rawSurahName = d.surah?.name || '';
        const surahName = rawSurahName.replace(/^سُورَةُ?\s*/i, '').trim();

        if (d.numberInSurah === 1) {
          if (surahNum === 1) {
            if (!ayahText.startsWith('بِسْمِ') && !ayahText.startsWith('بسم')) {
              ayahText = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
            }
          } else if (surahNum !== 9) {
            ayahText = removeLeadingBasmala(ayahText);
          }
        }

        const ayahObj: PageAyah = {
          number: d.number,
          numberInSurah: d.numberInSurah,
          text: ayahText,
          surahNumber: surahNum,
          surahName: surahName,
          juzNumber: d.juz || 1,
          hizbQuarter: d.hizbQuarter || 1,
          sajda: d.sajda || false
        };
        return ayahObj;
      }
    } catch {}
  }

  return null;
}

