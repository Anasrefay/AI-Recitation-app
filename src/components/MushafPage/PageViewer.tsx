import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { PageMetadata } from '../../data/pages-metadata';
import { getPageVerses, PageVersesData, PageAyah, removeLeadingBasmala } from '../../lib/quran-verses';
import { ThemeMode } from '../Header/AppHeader';
import { 
  RefreshCw, 
  AlertCircle, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  HelpCircle,
  BookOpen,
  Image as ImageIcon,
  FileText,
  Mic
} from 'lucide-react';
import { WordMatchStatus, RecitationAnalysisResponse } from '../../lib/recitation/types';
import { SURAHS } from '../../data/surahs';

interface PageViewerProps {
  pageNumber: number;
  metadata: PageMetadata;
  theme: ThemeMode;
  isDoublePageSpread?: boolean;
  zoomLevel: number;
  isTextHidden?: boolean;
  onToggleHideText?: () => void;
  onPageReload?: () => void;
  onSelectAyahForTafsir?: (ayah: PageAyah) => void;
  recitationWordStatuses?: Record<string, { status: WordMatchStatus; spoken?: string }>;
  latestRecitationAnalysis?: RecitationAnalysisResponse;
  activeLiveWordIds?: Set<string>;
  onClearRecitationHighlights?: () => void;
  onAutoNextPage?: () => void;
  viewMode?: 'image' | 'text';
  onToggleViewMode?: () => void;
  isRecording?: boolean;
  onStartRecording?: () => void;
}

// Convert western digits (123) to Eastern Arabic digits (١٢٣)
export function toArabicDigits(num: number): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, (d) => arabicDigits[parseInt(d, 10)]);
}

const lineLayoutCache = new Map<number, Record<string, number[]>>();

// يرجّع { "2:62": [1,1,1,2,2,...] } = رقم السطر لكل كلمة في كل آية (تقسيم مصحف المدينة)
async function fetchLineLayout(page: number): Promise<Record<string, number[]>> {
  const cached = lineLayoutCache.get(page);
  if (cached) return cached;

  try {
    const raw = localStorage.getItem(`mushaf_lines_v1_${page}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      lineLayoutCache.set(page, parsed);
      return parsed;
    }
  } catch {}

  const res = await fetch(
    `https://api.quran.com/api/v4/verses/by_page/${page}?mushaf=1&words=true&word_fields=line_number&per_page=50`
  );
  if (!res.ok) throw new Error('layout fetch failed');
  const json = await res.json();

  const out: Record<string, number[]> = {};
  for (const v of json.verses ?? []) {
    out[v.verse_key] = (v.words ?? [])
      .filter((w: any) => w.char_type_name === 'word')
      .sort((a: any, b: any) => a.position - b.position)
      .map((w: any) => w.line_number);
  }

  lineLayoutCache.set(page, out);
  try {
    localStorage.setItem(`mushaf_lines_v1_${page}`, JSON.stringify(out));
  } catch {}
  return out;
}

/**
 * Authentic Quranic Ayah End Medallion (Rosette / Zahra)
 * High-contrast ornamental rosette showing ayah number in Eastern Arabic digits.
 */
export const AyahEndMedallion: React.FC<{
  numberInSurah: number;
  theme: ThemeMode;
  isPeeked?: boolean;
  isTextHidden?: boolean;
}> = ({ numberInSurah, theme, isPeeked, isTextHidden }) => {
  const digits = toArabicDigits(numberInSurah);
  const fontSize = digits.length > 2 ? 'text-[11px] sm:text-[12px]' : 'text-[13px] sm:text-[15px]';

  // Explicit theme colors to guarantee high contrast
  let strokeColor = '#b45309'; // Rich dark amber for light
  let numColor = '#000000';    // Pitch black for numerals

  if (theme === 'dark') {
    strokeColor = isPeeked ? '#34d399' : isTextHidden ? '#fbbf24' : '#f59e0b';
    numColor = '#ffffff';
  } else if (theme === 'sepia') {
    strokeColor = isPeeked ? '#059669' : '#854d0e';
    numColor = '#1c1917';
  } else {
    // light
    strokeColor = isPeeked ? '#047857' : isTextHidden ? '#9a3412' : '#b45309';
    numColor = isPeeked ? '#065f46' : '#111827';
  }

  return (
    <span
      className={`ayah-number-badge inline-flex items-center justify-center relative cursor-pointer select-none transition-transform duration-200 align-middle w-7 h-7 sm:w-8 sm:h-8 mx-1 shrink-0 ${
        isTextHidden
          ? isPeeked
            ? 'scale-110'
            : 'hover:scale-115'
          : 'hover:scale-105'
      }`}
      aria-label={`آية ${numberInSurah}`}
    >
      {/* Quranic Rosette SVG Medallion */}
      <svg
        viewBox="0 0 44 44"
        className="w-full h-full drop-shadow-sm transition-colors duration-200"
        style={{ color: strokeColor }}
        fill="currentColor"
      >
        {/* Outer subtle halo ring */}
        <circle cx="22" cy="22" r="19.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" opacity="0.6" />
        
        {/* Main circular frame */}
        <circle cx="22" cy="22" r="16.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        
        {/* Inner ring */}
        <circle cx="22" cy="22" r="13" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.85" />

        {/* 8 Ornamental crests / Petals around circle */}
        {/* Top */}
        <path d="M22 2.5 C20 4.5, 24 4.5, 22 2.5 Z M20 5 L22 2.5 L24 5 Z" fill="currentColor" />
        {/* Bottom */}
        <path d="M22 41.5 C20 39.5, 24 39.5, 22 41.5 Z M20 39 L22 41.5 L24 39 Z" fill="currentColor" />
        {/* Right */}
        <path d="M41.5 22 C39.5 20, 39.5 24, 41.5 22 Z M39 20 L41.5 22 L39 24 Z" fill="currentColor" />
        {/* Left */}
        <path d="M2.5 22 C4.5 20, 4.5 24, 2.5 22 Z M5 20 L2.5 22 L5 24 Z" fill="currentColor" />
        
        {/* Diagonal accents */}
        <circle cx="8.5" cy="8.5" r="1.5" />
        <circle cx="35.5" cy="8.5" r="1.5" />
        <circle cx="8.5" cy="35.5" r="1.5" />
        <circle cx="35.5" cy="35.5" r="1.5" />
      </svg>

      {/* Eastern Arabic numeral inside medallion */}
      <span
        className={`absolute inset-0 flex items-center justify-center font-extrabold font-amiri leading-none ${fontSize}`}
        style={{ color: numColor, transform: 'translateY(-0.5px)' }}
      >
        {digits}
      </span>
    </span>
  );
};

export const PageViewer: React.FC<PageViewerProps> = ({
  pageNumber,
  metadata,
  theme,
  isDoublePageSpread = false,
  zoomLevel = 1,
  isTextHidden = false,
  onToggleHideText,
  onPageReload,
  onSelectAyahForTafsir,
  recitationWordStatuses = {},
  latestRecitationAnalysis,
  activeLiveWordIds = new Set(),
  onClearRecitationHighlights,
  onAutoNextPage,
  viewMode = 'image',
  onToggleViewMode,
  isRecording = false,
  onStartRecording
}) => {
  const [versesData, setVersesData] = useState<PageVersesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // Scanned Mushaf Image states (King Fahd Complex Madinah Mushaf)
  const paddedPage = String(pageNumber).padStart(3, '0');
  const primaryImageUrl = `https://files.quran.app/hafs/madani/width_1024/page${paddedPage}.png`;
  const fallbackImageUrl = `https://quran.ksu.edu.sa/ayat/safahat1/${pageNumber}.png`;

  const [imageSrc, setImageSrc] = useState(primaryImageUrl);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageSrc(primaryImageUrl);
    setIsImageLoading(true);
    setImageFailed(false);

    // Preload next and previous pages for instantaneous page flipping
    if (pageNumber < 604) {
      const nextImg = new window.Image();
      nextImg.src = `https://files.quran.app/hafs/madani/width_1024/page${String(pageNumber + 1).padStart(3, '0')}.png`;
    }
    if (pageNumber > 1) {
      const prevImg = new window.Image();
      prevImg.src = `https://files.quran.app/hafs/madani/width_1024/page${String(pageNumber - 1).padStart(3, '0')}.png`;
    }
  }, [pageNumber, primaryImageUrl]);

  const handleImageError = () => {
    if (imageSrc !== fallbackImageUrl) {
      setImageSrc(fallbackImageUrl);
    } else {
      setImageFailed(true);
      setIsImageLoading(false);
    }
  };

  // Track temporarily revealed verses in hidden mode
  const [peekedAyahs, setPeekedAyahs] = useState<Set<number>>(new Set());

  // Track auto page-turn status
  const [isAutoFlipping, setIsAutoFlipping] = useState<boolean>(false);
  const autoNextTimeoutRef = React.useRef<number | null>(null);
  const hasTriggeredFlipForPageRef = React.useRef<number | null>(null);

  // Selected word detail for inspection popover
  const [selectedWordInspection, setSelectedWordInspection] = useState<{
    expected: string;
    spoken?: string;
    status: WordMatchStatus;
    surahName: string;
    ayahNumber: number;
  } | null>(null);

  // Check if any recitation results exist on this page
  const statusList = Object.values(recitationWordStatuses) as Array<{ status: WordMatchStatus; spoken?: string }>;
  const hasRecitationResults = Object.keys(recitationWordStatuses).length > 0;
  const totalRecitationWords = statusList.length;
  const correctRecitationWords = statusList.filter(w => w.status === 'correct').length;
  const incorrectRecitationWords = statusList.filter(w => w.status === 'incorrect' || w.status === 'missing').length;
  const pageAccuracy = totalRecitationWords > 0 ? Math.round((correctRecitationWords / totalRecitationWords) * 100) : 0;

  // Flatten page words to compute sequential indices and lookup map
  const { allPageWords, wordIndexMap } = React.useMemo(() => {
    if (!versesData) return { allPageWords: [], wordIndexMap: {} as Record<string, number> };
    const list: Array<{ id: string; ayahNumber: number; text: string; pageWordIndex: number }> = [];
    const indexMap: Record<string, number> = {};
    let idx = 0;

    for (const surahItem of versesData.surahs) {
      const surahAyahs = versesData.ayahs.filter(a => a.surahNumber === surahItem.number);
      for (const ayah of surahAyahs) {
        const rawCleanText = (ayah.numberInSurah === 1 && ayah.surahNumber !== 1 && ayah.surahNumber !== 9)
          ? removeLeadingBasmala(ayah.text)
          : ayah.text;
        const cleanAyahText = rawCleanText.length > 0 ? rawCleanText : ayah.text;
        const wordsList = cleanAyahText.trim().split(/\s+/).filter(t => t.length > 0);
        for (let wIdx = 0; wIdx < wordsList.length; wIdx++) {
          const wId = `w_${ayah.surahNumber}_${ayah.numberInSurah}_${wIdx}`;
          list.push({
            id: wId,
            ayahNumber: ayah.number,
            text: wordsList[wIdx],
            pageWordIndex: idx
          });
          indexMap[wId] = idx;
          idx++;
        }
      }
    }
    return { allPageWords: list, wordIndexMap: indexMap };
  }, [versesData]);

  // Find min and max word indices recited/active on this page
  const { minRecitedIndex, maxRecitedIndex } = React.useMemo(() => {
    const indices: number[] = [];
    for (const item of allPageWords) {
      if (recitationWordStatuses[item.id] || activeLiveWordIds.has(item.id)) {
        indices.push(item.pageWordIndex);
      }
    }
    if (indices.length === 0) {
      return { minRecitedIndex: -1, maxRecitedIndex: -1 };
    }
    return {
      minRecitedIndex: Math.min(...indices),
      maxRecitedIndex: Math.max(...indices)
    };
  }, [allPageWords, recitationWordStatuses, activeLiveWordIds]);

  // Auto-flip to next page when the user reaches the end of current page
  useEffect(() => {
    if (!onAutoNextPage || pageNumber >= 604 || allPageWords.length === 0) {
      return;
    }

    if (hasTriggeredFlipForPageRef.current === pageNumber) {
      return;
    }

    // Trigger auto-flip if user has reached the final 1-2 words of the page and recited at least 2 words
    const isAtPageEnd = maxRecitedIndex >= allPageWords.length - 2 && (maxRecitedIndex - minRecitedIndex) >= 1;
    if (isAtPageEnd && !isAutoFlipping) {
      hasTriggeredFlipForPageRef.current = pageNumber;
      setIsAutoFlipping(true);

      autoNextTimeoutRef.current = window.setTimeout(() => {
        onAutoNextPage();
        setIsAutoFlipping(false);
      }, 950);
    }

    return () => {
      if (autoNextTimeoutRef.current) {
        clearTimeout(autoNextTimeoutRef.current);
      }
    };
  }, [maxRecitedIndex, minRecitedIndex, allPageWords.length, onAutoNextPage, isAutoFlipping, pageNumber]);

  // Fetch page verses text whenever pageNumber changes
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setHasError(false);
    setPeekedAyahs(new Set());
    setIsAutoFlipping(false);
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
    }

    const loadVerses = async () => {
      try {
        const data = await getPageVerses(pageNumber);
        if (isMounted) {
          setVersesData(data);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    };

    loadVerses();

    // Prefetch adjacent pages in the background for instant navigation
    const prefetchPages = [pageNumber + 1, pageNumber - 1];
    prefetchPages.forEach((p) => {
      if (p >= 1 && p <= 604) {
        getPageVerses(p).catch(() => {});
      }
    });

    return () => {
      isMounted = false;
    };
  }, [pageNumber]);

  // ===== تقسيم الصفحة لـ 15 سطر مثل مصحف المدينة =====
  const [wordLines, setWordLines] = useState<Record<string, number>>({});
  const [lineFont, setLineFont] = useState<number>(24);
  const linesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWordLines({});
    if (!versesData || allPageWords.length === 0) return;
    let cancelled = false;

    fetchLineLayout(pageNumber)
      .then((layout) => {
        if (cancelled) return;

        const counts: Record<string, number> = {};
        allPageWords.forEach((w) => {
          const [, s, a] = w.id.split('_');
          const k = `${s}:${a}`;
          counts[k] = (counts[k] ?? 0) + 1;
        });

        const map: Record<string, number> = {};
        allPageWords.forEach((w) => {
          const [, s, a, i] = w.id.split('_');
          const key = `${s}:${a}`;
          const apiLines = layout[key];
          if (!apiLines || apiLines.length === 0) return;
          const idx = Math.min(
            apiLines.length - 1,
            Math.floor((Number(i) * apiLines.length) / counts[key])
          );
          map[w.id] = apiLines[idx];
        });

        // لو أي كلمة ملهاش سطر نرجع للتخطيط القديم
        if (Object.keys(map).length === allPageWords.length) {
          setWordLines(map);
        } else {
          console.warn(
            `[lines] page ${pageNumber}: mapped ${Object.keys(map).length}/${allPageWords.length}`,
            'missing:',
            allPageWords.filter((w) => !(w.id in map)).map((w) => w.id)
          );
        }
      })
      .catch((e) => console.warn(`[lines] page ${pageNumber} fetch failed`, e));

    return () => {
      cancelled = true;
    };
  }, [versesData, allPageWords, pageNumber]);

  // ضبط حجم الخط ليملأ أعرض سطر العرض بالظبط، والأسطر القصيرة تتوسّط
  useLayoutEffect(() => {
    const el = linesRef.current;
    if (!el || Object.keys(wordLines).length === 0) return;

    const fit = () => {
      const rows = Array.from(el.querySelectorAll('[data-line]')) as HTMLElement[];
      if (rows.length === 0) return;
      const avail = el.clientWidth;
      const gap = lineFont * 0.25;

      const natural = rows.map((row: HTMLElement) => {
        const kids = Array.from(row.children) as HTMLElement[];
        const sum = kids.reduce((acc, c) => {
          const cs = getComputedStyle(c);
          return acc + c.offsetWidth + parseFloat(cs.marginLeft) + parseFloat(cs.marginRight);
        }, 0);
        return sum + gap * Math.max(0, kids.length - 1);
      });

      const widest = Math.max(...natural);
      if (!widest) return;

      rows.forEach((row: HTMLElement, i) => {
        const isEnd = row.dataset.end === 'true';
        const isShort = pageNumber <= 2 || (isEnd ? natural[i] / avail < 0.85 : natural[i] / avail < 0.5);
        row.style.justifyContent = isShort ? 'center' : 'space-between';
        row.style.columnGap = isShort ? '0.4em' : '0.25em';
      });

      const next = Math.max(14, Math.min(40, lineFont * (avail / widest) * 0.99));
      if (Math.abs(next - lineFont) > 0.5) setLineFont(next);
    };

    fit();
    (document as any).fonts?.ready?.then(fit);
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [wordLines, lineFont, pageNumber]);

  const togglePeekAyah = (ayahNum: number) => {
    if (!isTextHidden) return;
    setPeekedAyahs(prev => {
      const next = new Set(prev);
      if (next.has(ayahNum)) {
        next.delete(ayahNum);
      } else {
        next.add(ayahNum);
      }
      return next;
    });
  };

  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    getPageVerses(pageNumber)
      .then((data) => {
        setVersesData(data);
        setIsLoading(false);
      })
      .catch(() => {
        setHasError(true);
        setIsLoading(false);
      });
    if (onPageReload) onPageReload();
  };

  // Explicit theme classes and inline styles to ensure strong contrast regardless of system mode
  const isDark = theme === 'dark';
  const isSepia = theme === 'sepia';

  const containerBg = isDark ? '#141417' : isSepia ? '#f5ebd7' : '#fffdf5';
  const textColor = isDark ? '#ffffff' : isSepia ? '#221508' : '#0f172a'; // Deepest black on light paper
  const borderColor = isDark ? '#3f3f46' : isSepia ? '#9a6a2f' : '#b48325';
  const headerTextColor = isDark ? '#fde047' : isSepia ? '#78350f' : '#854d0e';
  const basmalaColor = isDark ? '#fef08a' : isSepia ? '#713f12' : '#854d0e';
  const frameBorder = isDark ? 'border-zinc-700' : isSepia ? 'border-[#b8860b]/60' : 'border-[#b8860b]/50';

  // ===== دوال رسم الأسطر =====
  const getAyahWords = (ayah: PageAyah): string[] => {
    const raw =
      ayah.numberInSurah === 1 && ayah.surahNumber !== 1 && ayah.surahNumber !== 9
        ? removeLeadingBasmala(ayah.text)
        : ayah.text;
    const clean = raw.length > 0 ? raw : ayah.text;
    return clean.trim().split(/\s+/).filter(Boolean);
  };

  const buildSurahLines = (surahAyahs: PageAyah[]) => {
    const lines = new Map<
      number,
      Array<{ ayah: PageAyah; wIdx: number; text: string; isLastWord: boolean }>
    >();
    for (const ayah of surahAyahs) {
      const words = getAyahWords(ayah);
      words.forEach((text, wIdx) => {
        const ln = wordLines[`w_${ayah.surahNumber}_${ayah.numberInSurah}_${wIdx}`] ?? 1;
        if (!lines.has(ln)) lines.set(ln, []);
        lines.get(ln)!.push({ ayah, wIdx, text, isLastWord: wIdx === words.length - 1 });
      });
    }
    return Array.from(lines.entries()).sort((a, b) => a[0] - b[0]);
  };

  // التظليل بيتعمل من غير ما يغيّر عرض الكلمة (px-1 مع -mx-1) عشان الأسطر متتحركش
  const renderLineWord = (ayah: PageAyah, wordText: string, wIdx: number, isPeeked: boolean) => {
    const wordId = `w_${ayah.surahNumber}_${ayah.numberInSurah}_${wIdx}`;
    const statusObj = recitationWordStatuses[wordId];
    const isLiveActive = activeLiveWordIds.has(wordId);
    const hasRecitationStatus = Boolean(statusObj || isLiveActive);
    const wordSequentialIdx = wordIndexMap[wordId] ?? 0;
    const isPriorToStart = minRecitedIndex > 0 && wordSequentialIdx < minRecitedIndex;
    const isWordHiddenInBg = isTextHidden && !isPeeked && !isPriorToStart && !hasRecitationStatus;

    let cls = 'shrink-0 cursor-pointer rounded-md transition-colors duration-150 ';
    const style: React.CSSProperties = { color: textColor };

    if (isWordHiddenInBg) {
      style.color = containerBg;
      style.userSelect = 'none';
      cls += 'select-none ';
    } else if (isLiveActive && isRecording) {
      style.color = isDark ? '#f4f4f5' : '#1e293b';
      style.backgroundColor = isDark ? 'rgba(244,244,245,0.16)' : 'rgba(100,116,139,0.12)';
      style.boxShadow = `inset 0 -2px 0 ${isDark ? 'rgba(228,228,231,0.45)' : 'rgba(100,116,139,0.35)'}`;
      cls += 'px-1 -mx-1 ';
    } else if (statusObj?.status === 'incorrect') {
      style.color = '#ffffff';
      style.backgroundColor = '#e11d48';
      cls += 'px-1 -mx-1 ';
    } else if (statusObj?.status === 'missing') {
      style.color = '#fecdd3';
      style.backgroundColor = 'rgba(76,5,25,0.8)';
      style.boxShadow = 'inset 0 0 0 1px rgba(244,63,94,0.8)';
      cls += 'px-1 -mx-1 ';
    }

    return (
      <span
        key={wordId}
        className={cls}
        style={style}
        onClick={(e) => {
          e.stopPropagation();
          if (statusObj && (statusObj.status === 'incorrect' || statusObj.status === 'missing')) {
            setSelectedWordInspection({
              expected: wordText,
              spoken: statusObj.spoken,
              status: statusObj.status,
              surahName: versesData?.surahs.find((s) => s.number === ayah.surahNumber)?.name ?? '',
              ayahNumber: ayah.numberInSurah
            });
          } else if (isTextHidden && !hasRecitationStatus) {
            togglePeekAyah(ayah.number);
          } else if (onSelectAyahForTafsir) {
            onSelectAyahForTafsir(ayah);
          }
        }}
        title={
          statusObj?.status === 'incorrect'
            ? `خطأ في الكلمة: قيل (${statusObj.spoken || 'غير واضح'}) - انقر للمقارنة والتصويب`
            : statusObj?.status === 'missing'
            ? 'كلمة مفقودة / تم تخطيها - انقر للمعاينة'
            : statusObj?.status === 'correct'
            ? 'كلمة صحيحة'
            : isTextHidden
            ? 'انقر لكشف الآية'
            : 'انقر لتفسير الآية'
        }
      >
        {wordText}
      </span>
    );
  };

  const renderLineMedallion = (ayah: PageAyah, isPeeked: boolean) => {
    const firstWId = `w_${ayah.surahNumber}_${ayah.numberInSurah}_0`;
    const ayahStartWordIdx = wordIndexMap[firstWId] ?? 0;
    const isAyahPriorToRecitation = minRecitedIndex > 0 && ayahStartWordIdx < minRecitedIndex;
    return (
      <span
        className="cursor-pointer inline-flex items-center whitespace-nowrap"
        onClick={() => {
          if (isTextHidden) togglePeekAyah(ayah.number);
          else if (onSelectAyahForTafsir) onSelectAyahForTafsir(ayah);
        }}
      >
        <AyahEndMedallion
          numberInSurah={ayah.numberInSurah}
          theme={theme}
          isPeeked={isPeeked}
          isTextHidden={isTextHidden && !isAyahPriorToRecitation}
        />
      </span>
    );
  };


  const isImageMode = viewMode === 'image' && !imageFailed;

  return (
    <div
      className={`relative mx-auto flex flex-col justify-between rounded-xl sm:rounded-2xl border-2 transition-all duration-300 overflow-hidden shadow-2xl ${frameBorder}`}
      style={{
        backgroundColor: containerBg,
        color: textColor,
        width: isDoublePageSpread ? '49%' : '100%',
        maxWidth: isDoublePageSpread ? '640px' : '640px',
        minHeight: 'calc(100vh - 80px)',
        transform: `scale(${zoomLevel})`,
        transformOrigin: 'center top'
      }}
      dir="rtl"
    >
      {/* Traditional Madinah Mushaf Top Header Bar */}
      <div 
        className="w-full px-4 sm:px-6 pt-3 sm:pt-4 pb-2 border-b flex items-center justify-between text-xs sm:text-sm font-amiri font-bold select-none shrink-0"
        style={{ borderColor: isDark ? '#27272a' : '#e2d4b7', color: headerTextColor }}
      >
        {/* Right side: Surah Name */}
        <div className="flex items-center gap-1">
          <span>سُورَةُ {metadata.surahName.replace(/^سُورَةُ?\s*/i, '')}</span>
        </div>

        {/* Center: Decorative Traditional Dot Divider (Clean Madinah Mushaf Header) */}
        <div className="text-xs tracking-widest opacity-60" style={{ color: headerTextColor }}>
          ۞ ۞ ۞
        </div>

        {/* Left side: Juz Name */}
        <div className="flex items-center gap-1">
          <span>الجُزْءُ {toArabicDigits(metadata.juzNumber)}</span>
        </div>
      </div>

      {/* VIEW MODE 1: Scanned King Fahd Complex Mushaf Page Image */}
      {isImageMode ? (
        <div className="relative flex-1 w-full flex flex-col items-center justify-start p-2 sm:p-3 bg-inherit overflow-hidden min-h-[460px]">


          {/* Quick Record action on image if not recording */}

          {isImageLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 z-10 bg-inherit/95 backdrop-blur-xs">
              <div className="w-10 h-10 border-3 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-bold font-amiri" style={{ color: headerTextColor }}>
                جاري استحضار المصحف المدني ...
              </span>
            </div>
          )}

          <img
            src={imageSrc}
            alt={`مصحف المدينة المنورة - الصفحة ${toArabicDigits(pageNumber)}`}
            loading="eager"
            onLoad={() => setIsImageLoading(false)}
            onError={handleImageError}
            className={`w-full h-auto max-h-[82vh] object-contain select-none transition-all duration-300 rounded shadow-md ${
              isImageLoading ? 'opacity-0' : 'opacity-100'
            }`}
            style={{
              filter: isDark 
                ? 'invert(0.92) hue-rotate(180deg) brightness(0.95) contrast(1.18)' 
                : isSepia 
                ? 'sepia(0.3) contrast(1.05) brightness(0.96)' 
                : 'none'
            }}
          />
        </div>
      ) : (
        /* VIEW MODE 2: Interactive Digital Uthmani Text */
        <div 
          className="relative flex-1 flex flex-col justify-center px-3 sm:px-6 py-5 sm:py-8 min-h-[460px]"
        >


        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div className="w-10 h-10 border-3 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
            <span 
              className="text-xs font-bold font-amiri"
              style={{ color: isDark ? '#e4e4e7' : '#334155' }}
            >
              جاري تجهيز نص الصفحة {toArabicDigits(metadata.pageNumber)} بالرسم العثماني...
            </span>
          </div>
        ) : hasError || !versesData ? (
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
            <AlertCircle className="w-10 h-10 text-amber-600" />
            <div 
              className="text-sm font-bold"
              style={{ color: isDark ? '#ffffff' : '#0f172a' }}
            >
              تعذر جلب نص الصفحة {toArabicDigits(metadata.pageNumber)}
            </div>
            <p className="text-xs text-stone-500 max-w-xs">
              يرجى التحقق من اتصال الإنترنت، أو إعادة المحاولة.
            </p>
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 rounded-xl text-xs font-bold transition shadow"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة المحاولة</span>
            </button>
          </div>
        ) : (
          <div ref={linesRef} className="w-full flex flex-col space-y-5 animate-fadeIn">
            {versesData.surahs.map((surahItem) => {
              const surahAyahs = versesData.ayahs.filter(a => a.surahNumber === surahItem.number);
              const isFirstAyahInSurah = surahAyahs[0]?.numberInSurah === 1;
              const cleanTitle = surahItem.name.replace(/^سُورَةُ?\s*/i, '').trim();
              const surahObj = SURAHS.find(s => s.id === surahItem.number);

              return (
                <div key={surahItem.number} className="w-full space-y-4">
                  {/* Decorative Surah Title Frame - Full width banner matching authentic Madinah Mushaf */}
                  {isFirstAyahInSurah && (
                    <div className="my-4 select-none w-full">
                      {/* Full-width Surah Banner with authentic Madinah Mushaf layout */}
                      <div 
                        className="w-full relative py-2 sm:py-2.5 px-3 sm:px-6 rounded-xl border-2 flex items-center justify-between shadow-sm overflow-hidden"
                        style={{
                          backgroundColor: isDark ? '#1c1917' : isSepia ? '#ede0c8' : '#fef9ee',
                          borderColor: isDark ? '#d97706' : isSepia ? '#9a6a2f' : '#c28e2b',
                          color: isDark ? '#fde047' : isSepia ? '#78350f' : '#854d0e'
                        }}
                      >
                        {/* Right: Ayahs count */}
                        <div className="flex items-center gap-1 opacity-90 text-xs sm:text-sm font-amiri font-bold select-none">
                          <span className="hidden xs:inline">آيَاتُهَا</span>
                          <span>{toArabicDigits(surahObj?.ayahsCount || 0)}</span>
                        </div>

                        {/* Centered Surah Name */}
                        <div className="flex items-center justify-center gap-2 sm:gap-3">
                          <span className="text-base sm:text-xl opacity-75 font-amiri">۝</span>
                          <span className="font-amiri font-extrabold text-xl sm:text-2xl md:text-3xl tracking-wide py-0.5">
                            سُورَةُ {surahObj?.name || cleanTitle}
                          </span>
                          <span className="text-base sm:text-xl opacity-75 font-amiri">۝</span>
                        </div>

                        {/* Left: Place of revelation */}
                        <div className="flex items-center gap-1 opacity-90 text-xs sm:text-sm font-amiri font-bold select-none">
                          <span>{surahObj?.revelationType === 'مدنية' ? 'مَدَنِيَّةٌ' : 'مَكِّيَّةٌ'}</span>
                        </div>
                      </div>

                      {/* Basmala in Surah Header (for all surahs except Al-Fatiha #1 and At-Tawbah #9) */}
                      {surahItem.number !== 1 && surahItem.number !== 9 && (
                        <div 
                          className="text-center font-quran font-bold text-lg sm:text-2xl pt-4 pb-1 tracking-wide"
                          style={{ color: basmalaColor }}
                        >
                          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quranic Text Body (Pure Arabic Unicode Text in Uthmani Script) */}
                  {Object.keys(wordLines).length > 0 ? (
                    <div className="quran-lines w-full" dir="rtl">
                      {buildSurahLines(surahAyahs).map(([lineNo, items]) => (
                        <div
                          key={lineNo}
                          data-line={lineNo}
                          data-end={
                            items.some((it) => it.isLastWord && it.ayah.numberInSurah === surahObj?.ayahsCount)
                              ? 'true'
                              : 'false'
                          }
                          className="flex items-center justify-between font-quran whitespace-nowrap select-text"
                          style={{ fontSize: `${lineFont}px`, height: '2em', color: textColor }}
                        >
                          {items.map(({ ayah, wIdx, text, isLastWord }) => {
                            const isPeeked = peekedAyahs.has(ayah.number);
                            const wordEl = renderLineWord(ayah, text, wIdx, isPeeked);
                            return isLastWord ? (
                              <span
                                key={`${ayah.number}-end`}
                                className="inline-flex items-center shrink-0 whitespace-nowrap"
                              >
                                {wordEl}
                                {renderLineMedallion(ayah, isPeeked)}
                              </span>
                            ) : (
                              wordEl
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ) : (
                  <div
                    className="quran-page-text leading-[2.6] sm:leading-[2.9] md:leading-[3.3] text-[20px] sm:text-[23px] md:text-[26px] font-quran transition-all duration-300 font-normal select-text"
                    style={{ 
                      color: textColor,
                      textAlign: 'justify',
                      textJustify: 'inter-word',
                      textAlignLast: 'center',
                      wordSpacing: '0.08em'
                    }}
                    dir="rtl"
                  >
                    {surahAyahs.map((ayah) => {
                      const isPeeked = peekedAyahs.has(ayah.number);
                      const isAyahHidden = isTextHidden && !isPeeked;
                      
                      // For Ayah 1 of any surah (except Al-Fatiha #1 and At-Tawbah #9), ensure text has no duplicate Basmala
                      const rawCleanText = (ayah.numberInSurah === 1 && ayah.surahNumber !== 1 && ayah.surahNumber !== 9)
                        ? removeLeadingBasmala(ayah.text)
                        : ayah.text;
                      const cleanAyahText = rawCleanText.length > 0 ? rawCleanText : ayah.text;

                      // Split ayah into words for precise word-level synchronization
                      const wordsList = cleanAyahText.trim().split(/\s+/);

                      return (
                        <span
                          key={ayah.number}
                          className="ayah group transition-all duration-200 inline"
                        >
                          {/* 1. Ayah Words: rendered individually to support live recognition and mistake highlighting */}
                          <span
                            className="ayah-text inline"
                          >
                            {wordsList.map((wordText, wIdx) => {
                              const wordId = `w_${ayah.surahNumber}_${ayah.numberInSurah}_${wIdx}`;
                              const statusObj = recitationWordStatuses[wordId];
                              const isLiveActive = activeLiveWordIds.has(wordId);
                              const hasRecitationStatus = Boolean(statusObj || isLiveActive);
                              const wordSequentialIdx = wordIndexMap[wordId] ?? 0;

                              // Requirement 1: If started reciting from middle of page (minRecitedIndex > 0),
                              // reveal all prior verses/words before the starting point!
                              const isPriorToStart = minRecitedIndex > 0 && wordSequentialIdx < minRecitedIndex;

                              // Requirement 4: In hidden mode, unrecited text matches containerBg (invisible),
                              // and recited text appears in its natural color (textColor)!
                              const isWordHiddenInBg = isTextHidden && !isPeeked && !isPriorToStart && !hasRecitationStatus;

                              let wordClasses = 'inline-block transition-all duration-200 cursor-pointer ';
                              let wordStyle: React.CSSProperties = {};

                              if (isWordHiddenInBg) {
                                // Shown in background color so it occupies exact space but is completely invisible
                                wordStyle.color = containerBg;
                                wordStyle.userSelect = 'none';
                                wordClasses += 'select-none transition-colors duration-300 ';
                              } else if (isLiveActive && isRecording) {
                                // Transparent subtle off-white / light-grey highlight on ONLY the word currently being read (not green, no pulse)
                                wordStyle.color = isDark ? '#f4f4f5' : '#1e293b';
                                wordStyle.backgroundColor = isDark ? 'rgba(244, 244, 245, 0.16)' : 'rgba(100, 116, 139, 0.12)';
                                wordStyle.borderBottom = isDark ? '2px solid rgba(228, 228, 231, 0.45)' : '2px solid rgba(100, 116, 139, 0.35)';
                                wordClasses += 'px-1 py-0.5 mx-0.5 rounded-md font-medium transition-colors duration-150 ';
                              } else if (statusObj?.status === 'incorrect') {
                                // Mistaken or substituted word: ONLY this specific word is in RED
                                wordClasses += 'px-2 py-0.5 mx-0.5 my-0.5 rounded-md bg-rose-600 text-white border-2 border-rose-400 font-bold shadow-md opacity-100 cursor-pointer hover:scale-105 transition-transform ';
                              } else if (statusObj?.status === 'missing') {
                                // Omitted / Missing word: Red outlined badge
                                wordClasses += 'px-2 py-0.5 mx-0.5 my-0.5 rounded-md bg-rose-950/80 text-rose-200 border border-dashed border-rose-500 opacity-95 inline-block cursor-pointer hover:scale-105 transition-transform ';
                              } else {
                                // All other words remain in natural text color - no unrelated words are colored red
                                wordStyle.color = textColor;
                                wordClasses += 'px-0.5 py-0.5 mx-0.5 font-normal ';
                              }

                              return (
                                <span
                                  key={wIdx}
                                  className={wordClasses}
                                  style={wordStyle}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (statusObj && (statusObj.status === 'incorrect' || statusObj.status === 'missing')) {
                                      setSelectedWordInspection({
                                        expected: wordText,
                                        spoken: statusObj.spoken,
                                        status: statusObj.status,
                                        surahName: surahItem.name,
                                        ayahNumber: ayah.numberInSurah
                                      });
                                    } else if (isTextHidden && !hasRecitationStatus) {
                                      togglePeekAyah(ayah.number);
                                    } else if (onSelectAyahForTafsir) {
                                      onSelectAyahForTafsir(ayah);
                                    }
                                  }}
                                  title={
                                    statusObj?.status === 'incorrect'
                                      ? `خطأ في الكلمة: قيل (${statusObj.spoken || 'غير واضح'}) - انقر للمقارنة والتصويب`
                                      : statusObj?.status === 'missing'
                                      ? 'كلمة مفقودة / تم تخطيها - انقر للمعاينة'
                                      : statusObj?.status === 'correct'
                                      ? 'كلمة صحيحة'
                                      : isTextHidden
                                      ? 'انقر لكشف الآية'
                                      : 'انقر لتفسير الآية'
                                  }
                                >
                                  {wordText}
                                </span>
                              );
                            })}
                          </span>

                          {/* 2. Ayah Number Medallion: clickable for Tafsir or Peek */}
                          <span
                            className="cursor-pointer inline-flex items-center align-middle whitespace-nowrap"
                            onClick={() => {
                              if (isTextHidden) {
                                togglePeekAyah(ayah.number);
                              } else if (onSelectAyahForTafsir) {
                                onSelectAyahForTafsir(ayah);
                              }
                            }}
                          >
                            {(() => {
                              const firstWId = `w_${ayah.surahNumber}_${ayah.numberInSurah}_0`;
                              const ayahStartWordIdx = wordIndexMap[firstWId] ?? 0;
                              const isAyahPriorToRecitation = minRecitedIndex > 0 && ayahStartWordIdx < minRecitedIndex;
                              return (
                                <AyahEndMedallion
                                  numberInSurah={ayah.numberInSurah}
                                  theme={theme}
                                  isPeeked={isPeeked}
                                  isTextHidden={isTextHidden && !isAyahPriorToRecitation}
                                />
                              );
                            })()}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Word Recitation Error Inspection Popover Modal */}
        {selectedWordInspection && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
            onClick={() => setSelectedWordInspection(null)}
          >
            <div 
              className="relative w-full max-w-md p-5 sm:p-6 rounded-3xl bg-stone-900 border-2 border-stone-700 text-stone-100 shadow-2xl space-y-4 animate-scaleUp"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                  {selectedWordInspection.status === 'incorrect' ? (
                    <div className="flex items-center gap-2 text-rose-400">
                      <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                      <span>تصويب الخطأ في التلاوة</span>
                    </div>
                  ) : selectedWordInspection.status === 'missing' ? (
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                      <span>كلمة منسية / تم تخطيها</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>تلاوة صحيحة</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedWordInspection(null)}
                  className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-white rounded-full bg-stone-800 hover:bg-stone-700 transition"
                  title="إغلاق"
                >
                  ✕
                </button>
              </div>

              {/* Surah & Ayah Pill */}
              <div className="flex items-center justify-between text-xs text-stone-400 bg-stone-950/80 px-3.5 py-1.5 rounded-xl border border-stone-800">
                <span>سورة {selectedWordInspection.surahName.replace(/^سُورَةُ?\s*/i, '')}</span>
                <span>الآية {toArabicDigits(selectedWordInspection.ayahNumber)}</span>
              </div>

              {/* Comparison Cards */}
              <div className="space-y-3 pt-1">
                {/* 1. What was spoken / Heard in recitation */}
                {selectedWordInspection.status !== 'correct' && (
                  <div className="p-3.5 bg-rose-950/50 rounded-2xl border-2 border-rose-600/70 shadow-inner space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-rose-300 font-bold">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                      <span>أنت قلت في تلاوتك (الخطأ):</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-quran text-rose-200 font-bold text-center py-1">
                      {selectedWordInspection.spoken ? `« ${selectedWordInspection.spoken} »` : '(لم تُقرأ / تخطي الكلمة)'}
                    </div>
                  </div>
                )}

                {/* 2. What is correct in the Quran */}
                <div className="p-3.5 bg-emerald-950/50 rounded-2xl border-2 border-emerald-600/70 shadow-inner space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span>الصحيح في المصحف الشريف:</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-quran text-emerald-300 font-bold text-center py-1">
                    « {selectedWordInspection.expected} »
                  </div>
                </div>
              </div>

              {/* Close Action Button */}
              <button
                onClick={() => setSelectedWordInspection(null)}
                className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 active:bg-stone-900 text-stone-100 font-bold rounded-xl text-xs sm:text-sm transition border border-stone-700 shadow-md"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Traditional Madinah Mushaf Footer */}
      <div 
        className="w-full px-4 sm:px-8 py-2 sm:py-2.5 border-t flex items-center justify-center text-xs font-amiri font-bold select-none"
        style={{ borderColor: isDark ? '#27272a' : '#e2d4b7', color: headerTextColor }}
      >
        {/* Center: Page Number */}
        <div 
          className="px-4 py-0.5 rounded-full border text-sm sm:text-base font-extrabold shadow-sm"
          style={{
            backgroundColor: isDark ? '#27272a' : isSepia ? '#edd9b5' : '#fef3c7',
            borderColor: isDark ? '#fbbf24' : '#b45309',
            color: isDark ? '#fef08a' : '#78350f'
          }}
        >
          {toArabicDigits(metadata.pageNumber)}
        </div>
      </div>
    </div>
  );
};
