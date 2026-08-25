import React, { useState, useEffect } from 'react';
import { PageMetadata } from '../../data/pages-metadata';
import { getPageVerses, PageVersesData, removeLeadingBasmala } from '../../lib/quran-verses';
import { ThemeMode } from '../Header/AppHeader';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface PageViewerProps {
  pageNumber: number;
  metadata: PageMetadata;
  theme: ThemeMode;
  isDoublePageSpread?: boolean;
  zoomLevel: number;
  isTextHidden?: boolean;
  onToggleHideText?: () => void;
  onPageReload?: () => void;
}

// Convert western digits (123) to Eastern Arabic digits (١٢٣)
export function toArabicDigits(num: number): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, (d) => arabicDigits[parseInt(d, 10)]);
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
      className={`ayah-number-badge inline-flex items-center justify-center relative cursor-pointer select-none transition-transform duration-200 align-middle ${
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
  onPageReload
}) => {
  const [versesData, setVersesData] = useState<PageVersesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // Track temporarily revealed verses in hidden mode
  const [peekedAyahs, setPeekedAyahs] = useState<Set<number>>(new Set());

  // Fetch page verses text whenever pageNumber changes
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setHasError(false);
    setPeekedAyahs(new Set());

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

  return (
    <div
      className={`relative mx-auto flex flex-col justify-between rounded-xl sm:rounded-2xl border-2 transition-all duration-300 overflow-hidden shadow-2xl ${frameBorder}`}
      style={{
        backgroundColor: containerBg,
        color: textColor,
        width: isDoublePageSpread ? '49%' : '100%',
        maxWidth: isDoublePageSpread ? '640px' : '820px',
        minHeight: 'calc(100vh - 80px)',
        transform: `scale(${zoomLevel})`,
        transformOrigin: 'center top'
      }}
      dir="rtl"
    >
      {/* Traditional Madinah Mushaf Top Header Bar */}
      <div 
        className="w-full px-4 sm:px-8 pt-3 sm:pt-4 pb-2 border-b flex items-center justify-between text-xs sm:text-sm font-amiri font-bold select-none shrink-0"
        style={{ borderColor: isDark ? '#27272a' : '#e2d4b7', color: headerTextColor }}
      >
        {/* Right side: Surah Name */}
        <div className="flex items-center gap-1">
          <span>سُورَةُ {metadata.surahName.replace(/^سُورَةُ?\s*/i, '')}</span>
        </div>

        {/* Center: Decorative Traditional Dot Divider (No duplicate page number) */}
        <div className="text-xs tracking-widest opacity-60" style={{ color: headerTextColor }}>
          ۞ ۞ ۞
        </div>

        {/* Left side: Juz Name */}
        <div className="flex items-center gap-1">
          <span>الجُزْءُ {toArabicDigits(metadata.juzNumber)}</span>
        </div>
      </div>

      {/* Main Authentic Quranic HTML Text Surface */}
      <div 
        className="relative flex-1 flex flex-col justify-center px-4 sm:px-10 py-5 sm:py-8 min-h-[460px]"
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
          <div className="w-full flex flex-col space-y-5 animate-fadeIn">
            {versesData.surahs.map((surahItem) => {
              const surahAyahs = versesData.ayahs.filter(a => a.surahNumber === surahItem.number);
              const isFirstAyahInSurah = surahAyahs[0]?.numberInSurah === 1;
              const cleanTitle = surahItem.name.replace(/^سُورَةُ?\s*/i, '').trim();

              return (
                <div key={surahItem.number} className="w-full space-y-4">
                  {/* Decorative Surah Title Frame - Full width banner matching authentic Madinah Mushaf */}
                  {isFirstAyahInSurah && (
                    <div className="my-4 select-none w-full">
                      {/* Full-width Surah Banner */}
                      <div 
                        className="w-full relative py-2 sm:py-2.5 px-3 sm:px-6 rounded-lg border-2 flex items-center justify-between shadow-sm overflow-hidden"
                        style={{
                          backgroundColor: isDark ? '#1c1917' : isSepia ? '#ede0c8' : '#fef9ee',
                          borderColor: isDark ? '#d97706' : isSepia ? '#9a6a2f' : '#c28e2b',
                          color: isDark ? '#fde047' : isSepia ? '#78350f' : '#854d0e'
                        }}
                      >
                        {/* Decorative Left Arabesque Ornament */}
                        <div className="flex items-center gap-1.5 opacity-80 text-xs sm:text-sm font-amiri select-none">
                          <span className="text-amber-600 dark:text-amber-400">❖</span>
                          <span className="hidden sm:inline-block w-8 sm:w-16 h-[1px] bg-amber-600/40 dark:bg-amber-400/40"></span>
                        </div>

                        {/* Centered Surah Name */}
                        <div className="flex items-center justify-center gap-2 sm:gap-3">
                          <span className="text-base sm:text-xl opacity-75 font-amiri">۝</span>
                          <span className="font-amiri font-extrabold text-xl sm:text-2xl md:text-3xl tracking-wide py-0.5">
                            سُورَةُ {cleanTitle}
                          </span>
                          <span className="text-base sm:text-xl opacity-75 font-amiri">۝</span>
                        </div>

                        {/* Decorative Right Arabesque Ornament */}
                        <div className="flex items-center gap-1.5 opacity-80 text-xs sm:text-sm font-amiri select-none">
                          <span className="hidden sm:inline-block w-8 sm:w-16 h-[1px] bg-amber-600/40 dark:bg-amber-400/40"></span>
                          <span className="text-amber-600 dark:text-amber-400">❖</span>
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
                  <div
                    className="quran-page-text leading-[2.5] sm:leading-[2.8] md:leading-[3.2] text-[19px] sm:text-[23px] md:text-[26px] font-quran transition-all duration-300 font-normal"
                    style={{ color: textColor }}
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

                      return (
                        <span
                          key={ayah.number}
                          className="ayah group cursor-pointer transition-all duration-200"
                          onClick={() => togglePeekAyah(ayah.number)}
                          title={
                            isTextHidden
                              ? isPeeked
                                ? 'انقر لإخفاء الآية مرة أخرى'
                                : 'انقر لإظهار نص الآية والتأكد من الحفظ'
                              : undefined
                          }
                        >
                          {/* 1. Ayah Text: Real Arabic Unicode Text.
                              When hidden, opacity is 0 so it preserves the exact spatial geometry and line wrapping */}
                          <span
                            className={`ayah-text transition-all duration-300 ${
                              isAyahHidden
                                ? 'opacity-0 select-none pointer-events-none'
                                : isPeeked
                                ? 'font-bold px-1.5 py-0.5 rounded shadow-sm'
                                : 'opacity-100 select-text font-normal'
                            }`}
                            style={{
                              color: isPeeked
                                ? isDark ? '#4ade80' : '#047857'
                                : textColor,
                              backgroundColor: isPeeked
                                ? isDark ? 'rgba(74, 222, 128, 0.15)' : 'rgba(5, 150, 105, 0.15)'
                                : 'transparent'
                            }}
                          >
                            {cleanAyahText}{' '}
                          </span>

                          {/* 2. Ayah Number: Always visible circular rosette medallion in its exact position on the line */}
                          <AyahEndMedallion
                            numberInSurah={ayah.numberInSurah}
                            theme={theme}
                            isPeeked={isPeeked}
                            isTextHidden={isTextHidden}
                          />
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
