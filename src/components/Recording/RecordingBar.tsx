import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  Pause, 
  Play, 
  Trash2, 
  Volume2, 
  AlertCircle,
  X,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Settings,
  CheckCircle2,
  SendHorizontal,
  Zap,
  Clock,
  Radio,
  Eye
} from 'lucide-react';
import { VoiceRecorder } from '../../lib/recording/recorder';
import { RecordingState } from '../../lib/recording/types';
import { PageMetadata } from '../../data/pages-metadata';
import { PageAyah, getPageVerses } from '../../lib/quran-verses';
import { 
  analyzeRecitationAudio, 
  checkRecitationServerHealth 
} from '../../lib/recitation/recitation-service';
import { RecitationAnalysisResponse } from '../../lib/recitation/types';
import { RecitationSettingsModal } from '../Recitation/RecitationSettingsModal';

export type ChunkStreamingMode = 'periodic' | 'pause' | 'manual';

interface RecordingBarProps {
  currentPage: number;
  metadata: PageMetadata;
  isOpen: boolean;
  onClose: () => void;
  onRecordingSaved?: () => void;
  autoStart?: boolean;
  onAnalysisResult?: (result: RecitationAnalysisResponse) => void;
  onLiveMatchUpdate?: (matchedWordIds: string[]) => void;
  onStartRecitation?: () => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

export const RecordingBar: React.FC<RecordingBarProps> = ({
  currentPage,
  metadata,
  isOpen,
  onClose,
  onRecordingSaved,
  autoStart = false,
  onAnalysisResult,
  onLiveMatchUpdate,
  onStartRecitation,
  onRecordingStateChange
}) => {
  const [recorder, setRecorder] = useState<VoiceRecorder | null>(null);
  const [recState, setRecState] = useState<RecordingState>('idle');
  const [recDuration, setRecDuration] = useState<number>(0);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Chunk streaming options
  const [streamingMode, setStreamingMode] = useState<ChunkStreamingMode>(() => {
    return (localStorage.getItem('mushaf_chunk_mode') as ChunkStreamingMode) || 'periodic';
  });
  const [chunkIntervalSec, setChunkIntervalSec] = useState<number>(() => {
    const saved = localStorage.getItem('mushaf_chunk_interval');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed > 0 && parsed !== 3.5) return parsed;
    }
    return 1;
  });
  const [showChunkSettings, setShowChunkSettings] = useState<boolean>(false);
  const [isAnalyzingChunk, setIsAnalyzingChunk] = useState<boolean>(false);
  const [processedChunksCount, setProcessedChunksCount] = useState<number>(0);

  // AI Recitation Analysis states
  const [isFinalAnalyzing, setIsFinalAnalyzing] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<RecitationAnalysisResponse | null>(null);
  const [liveTranscriptionText, setLiveTranscriptionText] = useState<string>('');
  const [pageAyahs, setPageAyahs] = useState<PageAyah[]>([]);

  const hasAutoStartedRef = useRef<boolean>(false);
  const speechRecognitionRef = useRef<any>(null);
  const liveSpeechTranscriptRef = useRef<string>('');
  const isAnalyzingIncrementalRef = useRef<boolean>(false);
  const pendingChunkBlobRef = useRef<Blob | null>(null);
  const pageAyahsRef = useRef<PageAyah[]>([]);
  pageAyahsRef.current = pageAyahs;

  const currentPageRef = useRef<number>(currentPage);
  currentPageRef.current = currentPage;

  const chunkTimerRef = useRef<number | null>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  recorderRef.current = recorder;

  useEffect(() => {
    onRecordingStateChange?.(recState === 'recording');
  }, [recState, onRecordingStateChange]);

  // Save chunk preferences
  const handleSetStreamingMode = (mode: ChunkStreamingMode) => {
    setStreamingMode(mode);
    localStorage.setItem('mushaf_chunk_mode', mode);
  };

  const handleSetChunkInterval = (sec: number) => {
    setChunkIntervalSec(sec);
    localStorage.setItem('mushaf_chunk_interval', String(sec));
  };

  // Process chunk incrementally while recording continues
  const processIncrementalChunk = async (audioBlob: Blob) => {
    if (!pageAyahsRef.current || pageAyahsRef.current.length === 0) return;
    if (audioBlob.size < 500) return;

    if (isAnalyzingIncrementalRef.current) {
      pendingChunkBlobRef.current = audioBlob;
      return;
    }

    isAnalyzingIncrementalRef.current = true;
    setIsAnalyzingChunk(true);

    try {
      const analysis = await analyzeRecitationAudio(
        audioBlob,
        pageAyahsRef.current,
        currentPageRef.current,
        liveSpeechTranscriptRef.current
      );

      if (analysis) {
        if (analysis.transcription) {
          setLiveTranscriptionText(analysis.transcription);
        }
        if (analysis.matchedWordsCount > 0 || analysis.transcription) {
          setLatestAnalysis(analysis);
          if (onAnalysisResult) {
            onAnalysisResult(analysis);
          }
          if (onLiveMatchUpdate && analysis.matchedWordIds && analysis.matchedWordIds.length > 0) {
            // Keep highlight ONLY on the single word currently being read
            const currentReadingWordId = analysis.matchedWordIds[analysis.matchedWordIds.length - 1];
            onLiveMatchUpdate([currentReadingWordId]);
          }
        }
        setProcessedChunksCount((prev) => prev + 1);
      }
    } catch (err) {
      console.warn('Periodic chunk recitation analysis error:', err);
    } finally {
      isAnalyzingIncrementalRef.current = false;
      setIsAnalyzingChunk(false);

      if (pendingChunkBlobRef.current) {
        const nextBlob = pendingChunkBlobRef.current;
        pendingChunkBlobRef.current = null;
        setTimeout(() => {
          processIncrementalChunk(nextBlob);
        }, 60);
      }
    }
  };

  // Initialize recorder instance with automatic saktah/pause detection (persists across page flips)
  useEffect(() => {
    const rec = new VoiceRecorder({
      onStateChange: (state) => setRecState(state),
      onTimeUpdate: (seconds) => setRecDuration(seconds),
      onVolumeChange: (vol) => setVolumeLevel(vol),
      onError: (err) => setErrorMessage(err.message),
      onSilenceDetected: (blob) => {
        // Trigger on pause if streamingMode is 'periodic' or 'pause'
        if (streamingMode === 'periodic' || streamingMode === 'pause') {
          processIncrementalChunk(blob);
        }
      },
      silenceThresholdMs: 750, // Responsive ~0.75s pause triggers chunk analysis
      volumeThreshold: 5
    });
    setRecorder(rec);

    return () => {
      if (rec.getState() !== 'idle') {
        rec.discard();
      }
    };
  }, [streamingMode]);

  // Periodic chunk streaming timer during active recording
  useEffect(() => {
    if (recState === 'recording' && streamingMode === 'periodic' && recorder) {
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);

      chunkTimerRef.current = window.setInterval(async () => {
        if (!recorderRef.current || isAnalyzingIncrementalRef.current) return;
        try {
          const snapshotBlob = await recorderRef.current.getLatestSnapshotBlob();
          if (snapshotBlob && snapshotBlob.size > 500) {
            processIncrementalChunk(snapshotBlob);
          }
        } catch (err) {
          console.warn('Snapshot chunk fetch error:', err);
        }
      }, chunkIntervalSec * 1000);
    } else {
      if (chunkTimerRef.current) {
        clearInterval(chunkTimerRef.current);
        chunkTimerRef.current = null;
      }
    }

    return () => {
      if (chunkTimerRef.current) {
        clearInterval(chunkTimerRef.current);
        chunkTimerRef.current = null;
      }
    };
  }, [recState, streamingMode, chunkIntervalSec, recorder]);

  // Fetch page ayahs for comparison reference text
  useEffect(() => {
    getPageVerses(currentPage).then((data) => {
      if (data && data.ayahs) {
        setPageAyahs(data.ayahs);
      }
    });
    checkRecitationServerHealth().then((res) => {
      setServerOnline(res.isOnline);
    });
  }, [currentPage]);

  // Auto-start recording when opened via the mic button
  useEffect(() => {
    if (isOpen && autoStart && recorder && !hasAutoStartedRef.current && recState === 'idle') {
      hasAutoStartedRef.current = true;
      handleStartRecording();
    }
    if (!isOpen) {
      hasAutoStartedRef.current = false;
    }
  }, [isOpen, autoStart, recorder]);

  // Format seconds to MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Start recording
  const handleStartRecording = async () => {
    if (!recorder) return;
    setErrorMessage(null);
    setLatestAnalysis(null);
    setProcessedChunksCount(0);
    liveSpeechTranscriptRef.current = '';
    setLiveTranscriptionText('');

    // Trigger onStartRecitation callback to clear prior highlights and hide text automatically
    if (onStartRecitation) {
      onStartRecitation();
    }

    // Browser Web Speech API for instantaneous real-time transcription feedback
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'ar-SA';

        recognition.onresult = (event: any) => {
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript + ' ';
          }
          const cleaned = fullTranscript.trim();
          liveSpeechTranscriptRef.current = cleaned;
          // Show live interim words immediately until Whisper chunk locks in
          if (cleaned) {
            setLiveTranscriptionText(cleaned);
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('SpeechRecognition error:', e.error);
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      } catch (err) {
        console.warn('Web Speech API initialization:', err);
      }
    }

    try {
      await recorder.start();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر بدء تسجيل الصوت';
      setErrorMessage(msg);
    }
  };

  // Pause / Resume
  const handlePauseResume = () => {
    if (!recorder) return;
    if (recState === 'recording') {
      recorder.pause();
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch {}
      }
    } else if (recState === 'paused') {
      recorder.resume();
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.start(); } catch {}
      }
    }
  };

  // Stop recording and directly send full audio to AI model
  const handleStopAndAnalyze = async () => {
    if (!recorder) return;
    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
        speechRecognitionRef.current = null;
      } catch {}
    }

    try {
      const result = await recorder.stop();
      setRecDuration(0);
      setVolumeLevel(0);

      if (pageAyahsRef.current && pageAyahsRef.current.length > 0) {
        setIsFinalAnalyzing(true);
        try {
          const analysis = await analyzeRecitationAudio(
            result.blob,
            pageAyahsRef.current,
            currentPageRef.current,
            liveSpeechTranscriptRef.current
          );
          setLatestAnalysis(analysis);
          if (analysis.transcription) {
            setLiveTranscriptionText(analysis.transcription);
          }
          if (!analysis.transcription) {
            setErrorMessage('لم يتم التقاط صوت تلاوة واضح. يُرجى التلاوة بصوت مسموع والتأكد من إذن الميكروفون.');
          }
          if (onAnalysisResult) {
            onAnalysisResult(analysis);
          }
          if (onLiveMatchUpdate) {
            onLiveMatchUpdate([]);
          }
          if (onRecordingSaved) {
            onRecordingSaved();
          }
        } finally {
          setIsFinalAnalyzing(false);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل إيقاف التسجيل وتحليله';
      setErrorMessage(msg);
    }
  };

  // Discard recording
  const handleDiscard = () => {
    if (!recorder) return;
    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
    recorder.discard();
    setRecDuration(0);
    setVolumeLevel(0);
    setLatestAnalysis(null);
    setLiveTranscriptionText('');
    setProcessedChunksCount(0);
    if (onLiveMatchUpdate) {
      onLiveMatchUpdate([]);
    }
  };

  if (!isOpen) return null;

  return (
    <>

     <div
        className="fixed z-40 pointer-events-none animate-slideUp
                  bottom-2 left-0 right-0 px-2
                  lg:bottom-6 lg:right-6 lg:left-auto lg:w-[380px] lg:px-0"
      >
        <div className="max-w-2xl mx-auto lg:max-w-none lg:mx-0 bg-stone-900/95 text-stone-100 border border-amber-500/30 rounded-3xl shadow-2xl backdrop-blur-md overflow-hidden pointer-events-auto transition-all">

          {isExpanded && (
            <div className="p-2.5 sm:p-3 space-y-2">
              {/* Error banner if any */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-950/90 border border-rose-700/80 text-rose-200 text-xs flex items-start justify-between gap-3 shadow-lg animate-fadeIn">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                    <div className="leading-relaxed">
                      <span className="font-bold block text-rose-300 mb-0.5">ملاحظة:</span>
                      <span>{errorMessage}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={handleStartRecording}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition border border-rose-400/40 shadow-sm"
                    >
                      إعادة المحاولة
                    </button>
                    <button
                      onClick={() => setErrorMessage(null)}
                      aria-label="إغلاق الملاحظة"
                      title="إغلاق"
                      className="p-1 rounded-md text-rose-300 hover:text-white hover:bg-rose-800/60 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Final Analysis in Progress Loading */}
              {isFinalAnalyzing && (
                <div className="p-4 rounded-2xl bg-amber-950/50 border border-amber-500/60 text-amber-200 flex items-center justify-center gap-3 text-xs animate-pulse shadow-md">
                  <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-bold">
                    جاري المعالجة بالذكاء الاصطناعي...
                  </span>
                </div>
              )}


              {/* Mic / Pause button + timer */}
              <div
                dir="ltr"
                className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-stone-950/60 border border-stone-800/80"
              >
                {/* الجنب الشمال: تلميح أو زرار إنهاء */}
                {recState === 'idle' ? (
                  <p dir="rtl" className="text-[11px] text-stone-400">
                    {streamingMode === 'pause'
                      ? 'يتم إرسال الصوت فور التوقف أو السكتة بين الآيات'
                      : streamingMode === 'manual'
                      ? 'يتم إرسال الصوت وتحليله كاملاً عند الضغط على إنهاء'
                      : ''}
                  </p>
                ) : (
                  <button
                    dir="rtl"
                    onClick={handleStopAndAnalyze}
                    disabled={isFinalAnalyzing}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 text-xs font-extrabold shadow-lg transition disabled:opacity-50"
                  >
                    <SendHorizontal className="w-4 h-4 fill-current rotate-180" />
                    <span>إنهاء وتقييم</span>
                  </button>
                )}

                {/* التايمر + الزرار الدائري */}
                <div className="flex items-center gap-3 ml-auto">
                  {recState !== 'idle' && (
                    <span className="font-mono text-lg font-bold text-stone-100 tracking-wider tabular-nums">
                      {formatTime(recDuration)}
                    </span>
                  )}

                  <button
                    onClick={recState === 'idle' ? handleStartRecording : handlePauseResume}
                    aria-label={
                      recState === 'idle' ? 'التلاوة' : recState === 'recording' ? 'إيقاف مؤقت' : 'متابعة'
                    }
                    title={
                      recState === 'idle' ? 'التلاوة' : recState === 'recording' ? 'إيقاف مؤقت' : 'متابعة'
                    }
                    className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-400/30 transition shrink-0"
                  >
                    {recState === 'idle' ? (
                      <Mic className="w-6 h-6" />
                    ) : recState === 'recording' ? (
                      <Pause className="w-6 h-6 fill-current" />
                    ) : (
                      <Play className="w-6 h-6 fill-current" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recitation AI Settings Modal */}
      <RecitationSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          checkRecitationServerHealth().then((res) => setServerOnline(res.isOnline));
        }}
      />
    </>
  );
};
