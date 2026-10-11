import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PageAyah } from '../../lib/quran-verses';
import { ThemeMode } from '../Header/AppHeader';
import { RECITERS_LIST, Reciter, getReciterById, getAyahAudioUrl, DEFAULT_RECITER_ID } from '../../data/reciters';
import {
  Volume2,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Repeat,
  Repeat1,
  X,
  ChevronDown,
  Sparkles,
  ExternalLink,
  SlidersHorizontal,
  VolumeX,
  Music2
} from 'lucide-react';

interface AyahAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAyah: PageAyah | null;
  pageAyahs: PageAyah[];
  currentPage: number;
  theme: ThemeMode;
  onAyahChange?: (ayah: PageAyah) => void;
  onNextPage?: () => void;
  onPrevPage?: () => void;
}

export const AyahAudioModal: React.FC<AyahAudioModalProps> = ({
  isOpen,
  onClose,
  currentAyah,
  pageAyahs,
  currentPage,
  theme,
  onAyahChange,
  onNextPage,
  onPrevPage
}) => {
  // Stored preferred reciter
  const [selectedReciterId, setSelectedReciterId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mushaf_preferred_reciter') || DEFAULT_RECITER_ID;
    }
    return DEFAULT_RECITER_ID;
  });

  const [activeAyah, setActiveAyah] = useState<PageAyah | null>(currentAyah);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [repeatMode, setRepeatMode] = useState<'off' | 'single' | 'three'>('off');
  const [repeatCount, setRepeatCount] = useState<number>(0);
  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(true);
  const [isReciterDropdownOpen, setIsReciterDropdownOpen] = useState<boolean>(false);
  const [reciterSearchQuery, setReciterSearchQuery] = useState<string>('');

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedReciter: Reciter = getReciterById(selectedReciterId);

  // Sync active ayah when currentAyah changes from parent
  useEffect(() => {
    if (currentAyah) {
      setActiveAyah(currentAyah);
      setRepeatCount(0);
    } else if (pageAyahs.length > 0 && !activeAyah) {
      setActiveAyah(pageAyahs[0]);
      setRepeatCount(0);
    }
  }, [currentAyah, pageAyahs]);

  // Save preferred reciter
  const handleSelectReciter = (reciter: Reciter) => {
    setSelectedReciterId(reciter.id);
    localStorage.setItem('mushaf_preferred_reciter', reciter.id);
    setIsReciterDropdownOpen(false);
  };

  // Build audio URL
  const audioUrl = activeAyah
    ? getAyahAudioUrl(selectedReciter.subfolder, activeAyah.surahNumber, activeAyah.numberInSurah)
    : '';

  // Setup / reload audio when URL changes
  useEffect(() => {
    if (!isOpen || !audioUrl) return;

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(audioUrl);
    audio.playbackRate = playbackSpeed;
    audioRef.current = audio;
    setIsLoadingAudio(true);
    setAudioError(null);
    setCurrentTime(0);
    setDuration(0);

    const onCanPlay = () => {
      setIsLoadingAudio(false);
      setDuration(audio.duration || 0);
      if (isPlaying) {
        audio.play().catch((err) => {
          console.warn('Playback error:', err);
          setIsPlaying(false);
        });
      }
    };

    const onPlaying = () => {
      setIsLoadingAudio(false);
      setIsPlaying(true);
    };

    const onPause = () => {
      setIsPlaying(false);
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const onError = () => {
      setIsLoadingAudio(false);
      setIsPlaying(false);
      setAudioError('تعذر تحميل تسجيل الآية. تحقق من اتصال الإنترنت.');
    };

    const onEnded = () => {
      handleAudioEnded();
    };

    if (audio.readyState >= 2) {
      setIsLoadingAudio(false);
      setDuration(audio.duration || 0);
    }

    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('error', onError);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl, isOpen]);

  // Update playback speed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Play / Pause toggle
  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setAudioError(null);
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Play failed:', err);
          setAudioError('تعذر بدء تشغيل الصوت. انقر للمحاولة مجدداً.');
          setIsPlaying(false);
        });
    }
  };

  // Find next and previous ayah on current page
  const currentAyahIndex = pageAyahs.findIndex(
    (a) => a.surahNumber === activeAyah?.surahNumber && a.numberInSurah === activeAyah?.numberInSurah
  );

  const hasNextAyah = currentAyahIndex >= 0 && currentAyahIndex < pageAyahs.length - 1;
  const hasPrevAyah = currentAyahIndex > 0;

  // Next Ayah handler
  const handleNextAyah = useCallback(() => {
    if (hasNextAyah) {
      const next = pageAyahs[currentAyahIndex + 1];
      setActiveAyah(next);
      setRepeatCount(0);
      if (onAyahChange) onAyahChange(next);
    } else if (onNextPage && currentPage < 604) {
      // Turn to next page
      onNextPage();
    }
  }, [hasNextAyah, currentAyahIndex, pageAyahs, onAyahChange, onNextPage, currentPage]);

  // Previous Ayah handler
  const handlePrevAyah = useCallback(() => {
    if (hasPrevAyah) {
      const prev = pageAyahs[currentAyahIndex - 1];
      setActiveAyah(prev);
      setRepeatCount(0);
      if (onAyahChange) onAyahChange(prev);
    } else if (onPrevPage && currentPage > 1) {
      onPrevPage();
    }
  }, [hasPrevAyah, currentAyahIndex, pageAyahs, onAyahChange, onPrevPage, currentPage]);

  // When audio finishes playing
  const handleAudioEnded = () => {
    if (repeatMode === 'single') {
      // Repeat current ayah indefinitely
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } else if (repeatMode === 'three') {
      // Repeat 3 times then proceed
      if (repeatCount < 2) {
        setRepeatCount((prev) => prev + 1);
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
      } else {
        setRepeatCount(0);
        if (autoPlayNext && hasNextAyah) {
          handleNextAyah();
        } else {
          setIsPlaying(false);
        }
      }
    } else if (autoPlayNext && hasNextAyah) {
      // Move to next ayah automatically
      handleNextAyah();
    } else {
      setIsPlaying(false);
    }
  };

  // Seek bar handler
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Keyboard navigation & playback control
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'ArrowLeft') {
        // In Arabic RTL, left arrow goes to next item
        e.preventDefault();
        handleNextAyah();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handlePrevAyah();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, togglePlayPause, handleNextAyah, handlePrevAyah, onClose]);

  // Stop audio when modal closes
  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    onClose();
  };

  // Format time mm:ss
  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || sec === 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Arabic numerals helper
  const toArabic = (n: number | string) => {
    const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(n).replace(/[0-9]/g, (d) => digits[parseInt(d, 10)]);
  };

  // Filter reciters
  const filteredReciters = RECITERS_LIST.filter(
    (r) =>
      r.name.includes(reciterSearchQuery) ||
      (r.country && r.country.includes(reciterSearchQuery)) ||
      (r.style && r.style.includes(reciterSearchQuery))
  );

  if (!isOpen || !activeAyah) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-fadeIn"
      dir="rtl"
    >
      <div className="relative w-full max-w-xl bg-stone-900 text-stone-100 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-800 bg-stone-950/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <span>الاستماع لتلاوة الآية</span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-300">
                  EveryAyah
                </span>
              </h3>
              <p className="text-xs text-stone-400">
                سورة {activeAyah.surahName} • الآية {toArabic(activeAyah.numberInSurah)} • صفحة {toArabic(currentPage)}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition"
            title="إغلاق"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* Reciter Selector Bar */}
          <div className="relative">
            <label className="block text-xs font-bold text-amber-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Music2 className="w-3.5 h-3.5 text-amber-400" />
                <span>القارئ المختار:</span>
              </span>
              <span className="text-[11px] font-normal text-stone-400">
                {selectedReciter.style && `(${selectedReciter.style})`} • {selectedReciter.bitrate}
              </span>
            </label>

            <button
              onClick={() => setIsReciterDropdownOpen(!isReciterDropdownOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl bg-stone-950/90 hover:bg-stone-950 border border-amber-600/30 hover:border-amber-500/50 text-stone-100 text-sm font-bold transition shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{selectedReciter.name}</span>
                {selectedReciter.style && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-800 text-amber-300 border border-stone-700 font-semibold">
                    {selectedReciter.style}
                  </span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${isReciterDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Reciter Dropdown Menu */}
            {isReciterDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 z-30 p-2.5 bg-stone-950 border border-amber-500/30 rounded-2xl shadow-2xl space-y-2 max-h-60 overflow-y-auto">
                <input
                  type="text"
                  placeholder="ابحث عن اسم القارئ..."
                  value={reciterSearchQuery}
                  onChange={(e) => setReciterSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-400"
                  autoFocus
                />

                <div className="space-y-1">
                  {filteredReciters.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => handleSelectReciter(r)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition ${
                        selectedReciterId === r.id
                          ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 font-bold'
                          : 'hover:bg-stone-900 text-stone-300 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{r.name}</span>
                        {r.style && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-300">
                            {r.style}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-500 font-mono">{r.bitrate}</span>
                    </button>
                  ))}
                  {filteredReciters.length === 0 && (
                    <p className="text-center text-xs text-stone-500 py-3">لا توجد نتائج مطابقة</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Ayah Display in Golden Frame */}
          <div className="p-4 sm:p-5 rounded-2xl border-2 border-amber-500/50 bg-gradient-to-b from-stone-950 via-amber-950/20 to-stone-950 shadow-inner space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-amber-300">
              <div className="flex items-center gap-2">
                <span className="font-amiri text-base font-bold text-amber-300">{activeAyah.surahName}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-200 text-xs font-bold shadow-xs">
                  الآية {toArabic(activeAyah.numberInSurah)}
                </span>
              </div>

              {/* Quick Ayah Selector within Page */}
              {pageAyahs.length > 1 && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-stone-400 hidden xs:inline">الآية في الصفحة:</span>
                  <select
                    value={activeAyah.numberInSurah}
                    onChange={(e) => {
                      const num = parseInt(e.target.value, 10);
                      const target = pageAyahs.find((a) => a.numberInSurah === num);
                      if (target) {
                        setActiveAyah(target);
                        setRepeatCount(0);
                        if (onAyahChange) onAyahChange(target);
                      }
                    }}
                    className="px-2 py-0.5 rounded-lg bg-stone-900 border border-amber-600/30 text-amber-200 text-xs font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    {pageAyahs.map((a) => (
                      <option key={a.number} value={a.numberInSurah}>
                        الآية {toArabic(a.numberInSurah)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <p className="text-xl sm:text-2xl font-quran text-white leading-[2.5] text-center font-bold tracking-wide select-text py-2">
              {activeAyah.text}
            </p>
          </div>

          {/* Audio Error Banner */}
          {audioError && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 text-xs flex items-center justify-between gap-2">
              <span>{audioError}</span>
              <button
                onClick={togglePlayPause}
                className="px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white font-bold text-[11px]"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {/* Audio Scrub Timeline */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-stone-400">
              <span>{formatSeconds(currentTime)}</span>
              <span>{formatSeconds(duration)}</span>
            </div>

            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              disabled={isLoadingAudio || duration === 0}
              className="w-full h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 transition-all"
            />
          </div>

          {/* Main Controls Center */}
          <div className="flex items-center justify-center gap-3 sm:gap-5 pt-2">
            {/* Prev Ayah Button */}
            <button
              onClick={handlePrevAyah}
              disabled={!hasPrevAyah && currentPage <= 1}
              className="flex items-center justify-center w-11 h-11 rounded-2xl bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-stone-200 hover:text-white border border-stone-700 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md cursor-pointer"
              title="الآية السابقة (السهم الأيمن)"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            {/* Play / Pause Main Button */}
            <button
              onClick={togglePlayPause}
              disabled={isLoadingAudio}
              className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 active:scale-95 text-stone-950 shadow-xl shadow-emerald-500/30 border-2 border-emerald-300/40 transition cursor-pointer disabled:opacity-50"
              title={isPlaying ? 'إيقاف مؤقت (مسافة)' : 'تشغيل التلاوة (مسافة)'}
            >
              {isLoadingAudio ? (
                <div className="w-6 h-6 border-3 border-stone-950 border-t-transparent rounded-full animate-spin"></div>
              ) : isPlaying ? (
                <Pause className="w-7 h-7 fill-current" />
              ) : (
                <Play className="w-7 h-7 fill-current ml-0.5" />
              )}
            </button>

            {/* Next Ayah Button */}
            <button
              onClick={handleNextAyah}
              disabled={!hasNextAyah && currentPage >= 604}
              className="flex items-center justify-center w-11 h-11 rounded-2xl bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-stone-200 hover:text-white border border-stone-700 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md cursor-pointer"
              title="الآية التالية (السهم الأيسر)"
            >
              <SkipBack className="w-5 h-5" />
            </button>
          </div>

          {/* Auxiliary Options: Repeat, Auto-continue, Speed */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-800 text-xs">
            {/* Repeat Mode */}
            <button
              onClick={() => {
                if (repeatMode === 'off') setRepeatMode('three');
                else if (repeatMode === 'three') setRepeatMode('single');
                else setRepeatMode('off');
              }}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border transition cursor-pointer ${
                repeatMode !== 'off'
                  ? 'bg-amber-950/60 border-amber-500/50 text-amber-300 font-bold'
                  : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
              title="وضع تكرار الآية"
            >
              <div className="flex items-center gap-1">
                {repeatMode === 'single' ? (
                  <Repeat1 className="w-4 h-4 text-amber-400" />
                ) : (
                  <Repeat className="w-4 h-4 text-amber-400" />
                )}
                <span className="text-[11px]">
                  {repeatMode === 'off'
                    ? 'تكرار: معطل'
                    : repeatMode === 'three'
                    ? `تكرار (${repeatCount + 1}/3)`
                    : 'تكرار دائم'}
                </span>
              </div>
            </button>

            {/* Auto Play Next */}
            <button
              onClick={() => setAutoPlayNext(!autoPlayNext)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border transition cursor-pointer ${
                autoPlayNext
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 font-bold'
                  : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
              title="تشغيل متتابع للآيات"
            >
              <div className="flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-[11px]">{autoPlayNext ? 'تشغيل متتابع' : 'إيقاف بعد الآية'}</span>
              </div>
            </button>

            {/* Playback Speed */}
            <button
              onClick={() => {
                if (playbackSpeed === 1) setPlaybackSpeed(0.75);
                else if (playbackSpeed === 0.75) setPlaybackSpeed(1.25);
                else if (playbackSpeed === 1.25) setPlaybackSpeed(1.5);
                else setPlaybackSpeed(1);
              }}
              className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-stone-950/60 border border-stone-800 text-stone-300 hover:text-white transition cursor-pointer"
              title="سرعة التلاوة"
            >
              <div className="flex items-center gap-1">
                <SlidersHorizontal className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-[11px] font-mono font-bold">السرعة: {playbackSpeed}x</span>
              </div>
            </button>
          </div>
        </div>

        {/* Footer Info */}
        <div className="px-5 py-3 border-t border-stone-800 bg-stone-950/90 flex items-center justify-between text-[11px] text-stone-400">
          <div className="flex items-center gap-1.5">
            <span>التسجيلات الصوتية مستضافة من</span>
            <a
              href="https://everyayah.com/data/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:underline font-mono inline-flex items-center gap-0.5"
            >
              everyayah.com/data
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="text-[10px] text-stone-500 hidden sm:block">
            مسافة: تشغيل/إيقاف • الأسهم: تنقل
          </div>
        </div>
      </div>
    </div>
  );
};
