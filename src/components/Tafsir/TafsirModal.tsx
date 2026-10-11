import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Sparkles, 
  BookOpen, 
  BrainCircuit, 
  RefreshCw, 
  Copy, 
  Check, 
  Volume2, 
  VolumeX, 
  Pause,
  Play,
  Settings, 
  Send, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  HelpCircle,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Loader2
} from 'lucide-react';
import { PageAyah, getAyahByGlobalNumber } from '../../lib/quran-verses';
import { ThemeMode } from '../Header/AppHeader';
import { RECITERS_LIST, getReciterById, getAyahAudioUrl, DEFAULT_RECITER_ID } from '../../data/reciters';
import { 
  requestTafsirFromFastApi, 
  checkFastApiHealth, 
  getFastApiConfig, 
  saveFastApiConfig,
  getClassicalTafsirForAyah,
  TafsirResponse,
  FastApiHealthStatus
} from '../../lib/fastapi-tafsir';
import { toArabicDigits } from '../MushafPage/PageViewer';
import { IslamicTafsirContent } from './IslamicTafsirContent';

interface TafsirModalProps {
  isOpen: boolean;
  onClose: () => void;
  ayah: PageAyah | null;
  theme: ThemeMode;
  onOpenSettings?: () => void;
  onAyahChange?: (newAyah: PageAyah) => void;
}

type TafsirMode = 'general' | 'linguistic' | 'lessons' | 'custom_question';

export const TafsirModal: React.FC<TafsirModalProps> = ({
  isOpen,
  onClose,
  ayah,
  theme,
  onOpenSettings,
  onAyahChange
}) => {
  const [currentAyah, setCurrentAyah] = useState<PageAyah | null>(ayah);
  const [isNavigatingAyah, setIsNavigatingAyah] = useState(false);
  const [mode, setMode] = useState<TafsirMode>('general');
  const [customQuestion, setCustomQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tafsirResult, setTafsirResult] = useState<TafsirResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // EveryAyah Audio Recitation state
  const [isPlayingAyahAudio, setIsPlayingAyahAudio] = useState(false);
  const [isLoadingAyahAudio, setIsLoadingAyahAudio] = useState(false);
  const [selectedReciterId, setSelectedReciterId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mushaf_preferred_reciter') || DEFAULT_RECITER_ID;
    }
    return DEFAULT_RECITER_ID;
  });
  const ayahAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // FastAPI Server Status & Config
  const [serverUrl, setServerUrl] = useState(() => getFastApiConfig().baseUrl);
  const [healthStatus, setHealthStatus] = useState<FastApiHealthStatus | null>(null);
  const [isCheckingServer, setIsCheckingServer] = useState(false);
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);

  const prevAyahNumberRef = useRef<number | null>(null);
  const questionInputRef = useRef<HTMLInputElement | null>(null);

  // Sync currentAyah when parent ayah changes
  useEffect(() => {
    if (ayah) {
      setCurrentAyah(ayah);
    }
  }, [ayah]);

  // Check health on mount or when URL changes
  useEffect(() => {
    if (isOpen) {
      pingServer(serverUrl);
    }
  }, [isOpen, serverUrl]);

  // When a new ayah is selected, reset and trigger tafsir fetch
  useEffect(() => {
    if (isOpen && currentAyah && prevAyahNumberRef.current !== currentAyah.number) {
      prevAyahNumberRef.current = currentAyah.number;
      setTafsirResult(null);
      setCustomQuestion('');
      fetchTafsir('general', undefined, currentAyah);
    }
  }, [isOpen, currentAyah]);

  // Clean up speech synthesis on close
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const pingServer = async (urlToCheck?: string) => {
    setIsCheckingServer(true);
    try {
      const status = await checkFastApiHealth(urlToCheck || serverUrl);
      setHealthStatus(status);
    } catch {
      setHealthStatus({
        isChecking: false,
        isConnected: false,
        serverUrl: urlToCheck || serverUrl,
        message: 'تعذر فحص السيرفر'
      });
    } finally {
      setIsCheckingServer(false);
    }
  };

  const fetchTafsir = async (
    selectedMode: TafsirMode = mode, 
    questionOverride?: string,
    targetAyah: PageAyah | null = currentAyah
  ) => {
    const active = targetAyah || currentAyah;
    if (!active) return;

    setIsLoading(true);
    setTafsirResult(null);

    try {
      const res = await requestTafsirFromFastApi({
        surahNumber: active.surahNumber,
        ayahNumber: active.numberInSurah,
        surahName: active.surahName,
        ayahText: active.text,
        pageNumber: active.number,
        juzNumber: active.juzNumber,
        mode: selectedMode,
        question: questionOverride || (selectedMode === 'custom_question' ? customQuestion : undefined)
      });

      setTafsirResult(res);
    } catch (err: unknown) {
      const error = err as Error;
      setTafsirResult({
        success: false,
        tafsir: '',
        error: error.message || 'حدث خطأ غير متوقع أثناء الاتصال بسيرفر'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate to Next Ayah
  const handleNextAyah = async () => {
    if (!currentAyah || currentAyah.number >= 6236 || isNavigatingAyah) return;
    setIsNavigatingAyah(true);
    try {
      const next = await getAyahByGlobalNumber(currentAyah.number + 1);
      if (next) {
        setCurrentAyah(next);
        onAyahChange?.(next);
      }
    } catch (err) {
      console.error('Failed to get next ayah:', err);
    } finally {
      setIsNavigatingAyah(false);
    }
  };

  // Navigate to Previous Ayah
  const handlePrevAyah = async () => {
    if (!currentAyah || currentAyah.number <= 1 || isNavigatingAyah) return;
    setIsNavigatingAyah(true);
    try {
      const prev = await getAyahByGlobalNumber(currentAyah.number - 1);
      if (prev) {
        setCurrentAyah(prev);
        onAyahChange?.(prev);
      }
    } catch (err) {
      console.error('Failed to get prev ayah:', err);
    } finally {
      setIsNavigatingAyah(false);
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft') {
        // Forward in RTL
        handleNextAyah();
      } else if (e.key === 'ArrowRight') {
        // Backward in RTL
        handlePrevAyah();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentAyah, isNavigatingAyah, mode]);

  const handleModeChange = (newMode: TafsirMode) => {
    setMode(newMode);
    if (newMode !== 'custom_question') {
      fetchTafsir(newMode);
    }
  };

  const handleCustomQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim()) return;
    fetchTafsir('custom_question', customQuestion);
  };

  const handleCopy = () => {
    const active = currentAyah || ayah;
    if (!tafsirResult?.tafsir || !active) return;
    const shareText = `سورة ${active.surahName} [الآية ${active.numberInSurah}]:\n«${active.text}»\n\nتفسير الذكاء الاصطناعي:\n${tafsirResult.tafsir}`;
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleToggleSpeak = () => {
    if (!('speechSynthesis' in window)) {
      alert('ميزة القراءة الصوتية غير مدعومة في متصفحك.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!tafsirResult?.tafsir) return;

    const utterance = new SpeechSynthesisUtterance(tafsirResult.tafsir);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  // EveryAyah Audio Playback
  useEffect(() => {
    return () => {
      if (ayahAudioRef.current) {
        ayahAudioRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    if (ayahAudioRef.current) {
      ayahAudioRef.current.pause();
    }
    setIsPlayingAyahAudio(false);
    setIsLoadingAyahAudio(false);
  }, [currentAyah?.number, isOpen]);

  const handleTogglePlayAyahAudio = () => {
    const active = currentAyah || ayah;
    if (!active) return;

    if (isPlayingAyahAudio && ayahAudioRef.current) {
      ayahAudioRef.current.pause();
      setIsPlayingAyahAudio(false);
      return;
    }

    const reciter = getReciterById(selectedReciterId);
    const audioUrl = getAyahAudioUrl(reciter.subfolder, active.surahNumber, active.numberInSurah);

    if (ayahAudioRef.current) {
      ayahAudioRef.current.pause();
    }

    const audio = new Audio(audioUrl);
    ayahAudioRef.current = audio;
    setIsLoadingAyahAudio(true);

    const onPlaySuccess = () => {
      setIsLoadingAyahAudio(false);
      setIsPlayingAyahAudio(true);
    };

    const onPlayFailed = () => {
      setIsLoadingAyahAudio(false);
      setIsPlayingAyahAudio(false);
    };

    audio.oncanplay = onPlaySuccess;
    audio.onplay = onPlaySuccess;
    audio.onended = () => {
      setIsPlayingAyahAudio(false);
    };
    audio.onerror = onPlayFailed;

    audio.play().then(onPlaySuccess).catch((err) => {
      // If browser awaits user gesture or buffering, keep waiting for canplay or user click
      console.warn('Audio play request:', err);
    });
  };

  const handleSaveServerUrl = (newUrl: string) => {
    setServerUrl(newUrl);
    saveFastApiConfig({ baseUrl: newUrl });
    pingServer(newUrl);
  };

  const activeAyah = currentAyah || ayah;
  if (!isOpen || !activeAyah) return null;

  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/75 backdrop-blur-sm animate-fadeIn" dir="rtl">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-stone-900 text-stone-100 border border-stone-700/80 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-stone-800 bg-stone-900/95 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-amiri text-amber-200">
                  تفسير الذكاء الاصطناعي
                </h2>
              </div>
            </div>
          </div>

        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
          
          {/* Selected Ayah Box in Golden Frame */}
          <div className="p-4 sm:p-5 rounded-2xl border-2 border-amber-500/60 bg-gradient-to-b from-stone-900 via-amber-950/20 to-stone-950 shadow-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-amber-300">
              <div className="flex items-center gap-2">
                <span className="font-ruqaa text-base font-bold text-amber-300">{activeAyah.surahName}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-200 text-xs font-bold shadow-xs">
                  الآية {toArabicDigits(activeAyah.numberInSurah)}
                </span>
              </div>

              {/* EveryAyah Audio Recitation Button & Reciter Selector */}
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedReciterId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedReciterId(newId);
                    localStorage.setItem('mushaf_preferred_reciter', newId);
                    if (isPlayingAyahAudio && ayahAudioRef.current) {
                      ayahAudioRef.current.pause();
                      setIsPlayingAyahAudio(false);
                    }
                  }}
                  className="bg-stone-900 border border-amber-600/40 text-amber-300 text-[11px] font-semibold rounded-lg px-2 py-1 focus:outline-none focus:border-amber-400 cursor-pointer max-w-[140px] sm:max-w-[180px] truncate"
                  title="تغيير القارئ (EveryAyah)"
                >
                  {RECITERS_LIST.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.style ? `(${r.style})` : ''}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleTogglePlayAyahAudio}
                  disabled={isLoadingAyahAudio}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
                    isPlayingAyahAudio
                      ? 'bg-emerald-600 text-stone-950 border border-emerald-400'
                      : 'bg-stone-800 hover:bg-stone-700 text-emerald-300 border border-emerald-600/40'
                  }`}
                  title={isPlayingAyahAudio ? 'إيقاف التلاوة' : 'الاستماع لتلاوة الآية'}
                >
                  {isLoadingAyahAudio ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  ) : isPlayingAyahAudio ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>إيقاف</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>استماع</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-quran text-white leading-[2.4] text-center font-bold tracking-wide drop-shadow-sm select-text">
              {activeAyah.text}
            </p>
          </div>

          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-stone-950 border border-stone-800 rounded-xl">
            <button
              onClick={() => handleModeChange('general')}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                mode === 'general'
                  ? 'bg-amber-600 text-stone-950 shadow-md'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span>التفسير الشامل</span>
            </button>

            <button
              onClick={() => handleModeChange('linguistic')}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                mode === 'linguistic'
                  ? 'bg-amber-600 text-stone-950 shadow-md'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>اللطائف واللغة</span>
            </button>

            <button
              onClick={() => handleModeChange('lessons')}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                mode === 'lessons'
                  ? 'bg-amber-600 text-stone-950 shadow-md'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>الهدايات والفوائد</span>
            </button>

            <button
              onClick={() => handleModeChange('custom_question')}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                mode === 'custom_question'
                  ? 'bg-amber-600 text-stone-950 shadow-md'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              <span>سؤال للـ AI</span>
            </button>
          </div>

          {/* Custom Question Input (when mode is custom_question) */}
          {mode === 'custom_question' && (
            <form onSubmit={handleCustomQuestionSubmit} className="space-y-2">
              <div className="flex gap-2">
                <input
                  ref={questionInputRef}
                  type="text"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="اكتب سؤالك أو استفسارك حول الآية لموديل الذكاء الاصطناعي..."
                  className="flex-1 px-3.5 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-xs focus:outline-none focus:border-amber-500 transition"
                />
                <button
                  type="submit"
                  disabled={isLoading || !customQuestion.trim()}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] text-stone-500">اقتراحات سريعة:</span>
                {[
                  'ما سبب نزول هذه الآية الكريمة؟',
                  'ما الحكمة البيانية في اختيار هذه الكلمات؟',
                  'كيف أطبق هذه الآية في حياتي اليومية؟'
                ].map((sugg) => (
                  <button
                    key={sugg}
                    type="button"
                    onClick={() => {
                      setCustomQuestion(sugg);
                      questionInputRef.current?.focus();
                    }}
                    className="px-2.5 py-1 bg-stone-950 hover:bg-stone-800 text-stone-300 hover:text-amber-300 border border-stone-800 hover:border-amber-500/50 rounded-lg text-[11px] transition cursor-pointer"
                  >
                    {sugg}
                  </button>
                ))}
              </div>
            </form>
          )}

          {/* Tafsir Output State */}
          <div className="min-h-[200px] flex flex-col">
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-amber-600/30 border-t-amber-500 animate-spin"></div>
                  <BrainCircuit className="w-6 h-6 text-amber-400 absolute inset-0 m-auto animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                  <div className="text-xs font-bold text-amber-200">
                    جاري استحضار معاني وبيان الآية الكريمة...
                  </div>
                  <p className="text-[11px] text-stone-400 font-amiri">
                    استخراج التفسير المعتمد والهدايات القرآنية المباركة
                  </p>
                </div>
              </div>
            ) : tafsirResult?.success ? (
              <IslamicTafsirContent
                rawText={tafsirResult.tafsir}
                surahName={activeAyah.surahName}
                ayahNumber={activeAyah.numberInSurah}
                modelUsed={tafsirResult.modelUsed}
                source={tafsirResult.source}
                processingTimeMs={tafsirResult.processingTimeMs}
                theme={theme}
                onRefresh={() => fetchTafsir(mode)}
                onCopy={handleCopy}
                isCopied={copied}
                onSpeak={handleToggleSpeak}
                isSpeaking={isSpeaking}
              />
            ) : tafsirResult && !tafsirResult.success ? (
              <div className="p-4 sm:p-5 bg-rose-950/20 border border-rose-900/40 rounded-xl space-y-3 animate-fadeIn">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-rose-300">
                      تعذر استلام التفسير من السيرفر
                    </div>
                    <p className="text-xs text-rose-200/80 leading-relaxed">
                      {tafsirResult.error}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-rose-900/30 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      if (activeAyah) {
                        const fallback = getClassicalTafsirForAyah({
                          surahNumber: activeAyah.surahNumber,
                          ayahNumber: activeAyah.numberInSurah,
                          surahName: activeAyah.surahName,
                          ayahText: activeAyah.text,
                          mode,
                          question: customQuestion
                        });
                        setTafsirResult(fallback);
                      }
                    }}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold rounded-lg text-xs transition flex items-center gap-1.5 shadow"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>عرض التفسير المعتمد (القرطبي والميسر)</span>
                  </button>
                  <button
                    onClick={() => fetchTafsir(mode)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-200 rounded-lg text-xs transition border border-stone-800"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>إعادة المحاولة</span>
                  </button>
                  <button
                    onClick={() => setShowConfigDrawer(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-medium transition"
                  >
                    <Settings className="w-3.5 h-3.5 text-stone-400" />
                    <span>إعدادات الرابط</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>

        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-stone-950 border-t border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevAyah}
              disabled={activeAyah.number <= 1 || isNavigatingAyah || isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-stone-300 hover:text-white border border-stone-700 text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed"
              title="الآية السابقة"
            >
              <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
              <span>الآية السابقة</span>
            </button>
            <button
              onClick={handleNextAyah}
              disabled={activeAyah.number >= 6236 || isNavigatingAyah || isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-stone-300 hover:text-white border border-stone-700 text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed"
              title="الآية التالية"
            >
              <span>الآية التالية</span>
              <ChevronLeft className="w-3.5 h-3.5 text-amber-400" />
            </button>
            {isNavigatingAyah && (
              <span className="text-[11px] text-amber-400 flex items-center gap-1 mr-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>جاري تحميل الآية...</span>
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
