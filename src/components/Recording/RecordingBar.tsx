import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, 
  Square, 
  Pause, 
  Play, 
  Trash2, 
  Download, 
  Volume2, 
  AlertCircle,
  X,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Loader2,
  CircleCheck,
  BookOpen
} from 'lucide-react';
import { VoiceRecorder } from '../../lib/recording/recorder';
import { RecordingState, VoiceRecording } from '../../lib/recording/types';
import { saveRecording, getRecordingsByPage, deleteRecording, downloadRecordingAudio, StoredRecording } from '../../lib/recording/storage';
import { PageMetadata } from '../../data/pages-metadata';
import { analyzeRecitation, RecitationAnalysis } from '../../lib/ai-recitation';
import { LiveTranscriptionClient, LiveTranscriptionResult } from '../../lib/live-transcription';

interface RecordingBarProps {
  currentPage: number;
  metadata: PageMetadata;
  isOpen: boolean;
  onClose: () => void;
  onRecordingSaved: () => void;
  autoStart?: boolean;
}

export const RecordingBar: React.FC<RecordingBarProps> = ({
  currentPage,
  metadata,
  isOpen,
  onClose,
  onRecordingSaved,
  autoStart = false
}) => {
  const [recorder, setRecorder] = useState<VoiceRecorder | null>(null);
  const [recState, setRecState] = useState<RecordingState>('idle');
  const [recDuration, setRecDuration] = useState<number>(0);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [pageRecordings, setPageRecordings] = useState<StoredRecording[]>([]);
  const [activePlaybackId, setActivePlaybackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);
  const [playbackDuration, setPlaybackDuration] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [analysis, setAnalysis] = useState<RecitationAnalysis | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [liveResult, setLiveResult] = useState<LiveTranscriptionResult | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const hasAutoStartedRef = useRef<boolean>(false);
  const liveClientRef = useRef<LiveTranscriptionClient | null>(null);

  // Initialize recorder instance
  useEffect(() => {
    const rec = new VoiceRecorder({
      onStateChange: (state) => setRecState(state),
      onTimeUpdate: (seconds) => setRecDuration(seconds),
      onVolumeChange: (vol) => setVolumeLevel(vol),
      onError: (err) => setErrorMessage(err.message),
      onDataAvailable: (chunk: Blob) => {
        const client = liveClientRef.current;
        if (client) {
          client.sendChunk(chunk);
        }
      }
    });
    setRecorder(rec);

    return () => {
      if (liveClientRef.current) {
        liveClientRef.current.close();
        liveClientRef.current = null;
      }
      if (rec.getState() !== 'idle') {
        rec.discard();
      }
    };
  }, []);

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

  // Load existing recordings for current page
  const loadPageRecordings = async () => {
    try {
      const records = await getRecordingsByPage(currentPage);
      setPageRecordings(records);
    } catch {
      // IndexedDB fallback
    }
  };

  useEffect(() => {
    loadPageRecordings();
    // Stop any active audio player when changing page
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setActivePlaybackId(null);
    }
  }, [currentPage]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

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
    setLiveResult(null);
    setLiveError(null);
    setAnalysis(null);
    setAnalysisError(null);

    const client = new LiveTranscriptionClient({
      onResult: (result) => setLiveResult(result),
      onError: (err) => setLiveError(err),
      onOpen: () => {},
      onClose: () => {},
    });
    liveClientRef.current = client;
    client.connect();

    try {
      await recorder.start();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر بدء تسجيل الصوت';
      setErrorMessage(msg);
      client.close();
      liveClientRef.current = null;
    }
  };

  // Pause / Resume
  const handlePauseResume = () => {
    if (!recorder) return;
    if (recState === 'recording') {
      recorder.pause();
    } else if (recState === 'paused') {
      recorder.resume();
    }
  };

  // Stop and save + auto-analyze
  const handleStopAndSave = async () => {
    if (!recorder) return;
    if (liveClientRef.current) {
      liveClientRef.current.stop();
      liveClientRef.current.close();
      liveClientRef.current = null;
    }
    try {
      const result = await recorder.stop();
      const newRec: VoiceRecording = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        pageNumber: currentPage,
        surahName: metadata.surahName,
        blob: result.blob,
        duration: result.duration,
        createdAt: Date.now(),
        mimeType: result.mimeType
      };

      await saveRecording(newRec);
      await loadPageRecordings();
      onRecordingSaved();
      setRecDuration(0);
      setVolumeLevel(0);

      // Auto-analyze the recording after stopping
      setAnalyzingId(newRec.id);
      setAnalysisError(null);
      setAnalysis(null);
      setLiveResult(null);
      setLiveError(null);
      try {
        const analysisResult = await analyzeRecitation(result.blob, currentPage);
        setAnalysis(analysisResult);
      } catch (err: unknown) {
        setAnalysisError(err instanceof Error ? err.message : 'تعذر تحليل التلاوة');
      } finally {
        setAnalyzingId(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل إيقاف وحفظ التسجيل';
      setErrorMessage(msg);
    }
  };

  // Discard recording
  const handleDiscard = () => {
    if (!recorder) return;
    if (liveClientRef.current) {
      liveClientRef.current.close();
      liveClientRef.current = null;
    }
    recorder.discard();
    setRecDuration(0);
    setVolumeLevel(0);
    setLiveResult(null);
    setLiveError(null);
  };

  // Play a stored recording
  const handlePlayRecording = (recording: StoredRecording) => {
    if (activePlaybackId === recording.id && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
    }

    const audioUrl = URL.createObjectURL(recording.blob);
    audioUrlRef.current = audioUrl;
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    setActivePlaybackId(recording.id);
    setIsPlaying(true);
    setPlaybackDuration(recording.duration);

    audio.ontimeupdate = () => {
      setPlaybackProgress(audio.currentTime);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setPlaybackProgress(0);
    };

    audio.play().catch(() => {
      setIsPlaying(false);
    });
  };

  // AI recitation analysis
  const handleAnalyzeRecording = async (recording: StoredRecording) => {
    setAnalyzingId(recording.id);
    setAnalysisError(null);
    setAnalysis(null);
    try {
      const result = await analyzeRecitation(recording.blob, recording.pageNumber);
      setAnalysis(result);
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : 'تعذر تحليل التلاوة');
    } finally {
      setAnalyzingId(null);
    }
  };

  // Delete a recording
  const handleDeleteRecording = async (id: string) => {
    if (activePlaybackId === id && audioRef.current) {
      audioRef.current.pause();
      setActivePlaybackId(null);
      setIsPlaying(false);
    }
    if (activePlaybackId === id && audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    await deleteRecording(id);
    await loadPageRecordings();
    onRecordingSaved();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-16 sm:bottom-20 left-0 right-0 z-40 px-2 sm:px-4 pointer-events-none animate-slideUp">
      <div className="max-w-2xl mx-auto bg-stone-900/95 text-stone-100 border border-amber-500/30 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden pointer-events-auto transition-all">
        {/* Header Drawer Control */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-stone-950/80 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></div>
            <span className="text-xs sm:text-sm font-bold font-amiri text-amber-200">
              تسجيل التلاوة - الصفحة {currentPage} (سورة {metadata.surahName})
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-stone-400 hover:text-white rounded transition"
              title={isExpanded ? "تصغير" : "توسيع"}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 text-stone-400 hover:text-white rounded transition"
              title="إغلاق لوحة التسجيل"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="p-3 sm:p-4 space-y-3">
            {/* Error banner if any */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/90 border border-rose-700/80 text-rose-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-lg animate-fadeIn">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold block text-rose-300 mb-0.5">تعذر تشغيل الميكروفون:</span>
                    <span>{errorMessage}</span>
                  </div>
                </div>
                <button
                  onClick={handleStartRecording}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition border border-rose-400/40 shadow-sm"
                >
                  إعادة المحاولة
                </button>
              </div>
            )}

            {/* Active Recording State vs Idle State */}
            {recState === 'idle' ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-950/60 p-3 rounded-xl border border-stone-800">
                <div className="text-xs text-stone-300 text-center sm:text-right">
                  <p className="font-semibold text-amber-300">سجّل تلاوتك وسنحلّلها بالذكاء الاصطناعي</p>
                  <p className="text-stone-400 text-[11px]">سيتم التعرف على السورة والآيات تلقائيًا من التسجيل</p>
                </div>

                <button
                  onClick={handleStartRecording}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-sm font-bold shadow-lg shadow-rose-600/30 transition whitespace-nowrap"
                >
                  <Mic className="w-4 h-4" />
                  <span>بدء التسجيل</span>
                </button>
              </div>
            ) : (
              /* Active Recording Panel */
              <div className="bg-stone-950/80 rounded-xl border border-rose-500/30 overflow-hidden">
                {/* Fixed Controls Row */}
                <div className="px-4 pt-3 pb-2 space-y-2">
                  <div className="flex items-center justify-between">
                    {/* Timer and Status */}
                    <div className="flex items-center gap-3">
                      <div className={`w-3.5 h-3.5 rounded-full ${
                        recState === 'recording' ? 'bg-rose-500 animate-ping' : 'bg-amber-500'
                      }`}></div>
                      <span className="font-mono text-xl font-bold text-stone-100 tracking-wider">
                        {formatTime(recDuration)}
                      </span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-800 text-stone-300">
                        {recState === 'recording' ? 'جاري التسجيل...' : 'متوقف مؤقتاً'}
                      </span>
                    </div>

                    {/* Volume indicator bar */}
                    {recState === 'recording' && (
                      <div className="flex items-center gap-1">
                        <Volume2 className="w-4 h-4 text-stone-400" />
                        <div className="w-16 h-2 bg-stone-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-75"
                            style={{ width: `${volumeLevel}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Control Action Buttons */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {/* Pause / Resume Button */}
                      <button
                        onClick={handlePauseResume}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition"
                      >
                        {recState === 'recording' ? (
                          <>
                            <Pause className="w-3.5 h-3.5 text-amber-400" />
                            <span>إيقاف مؤقت</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 text-emerald-400" />
                            <span>متابعة</span>
                          </>
                        )}
                      </button>

                      {/* Discard Button */}
                      <button
                        onClick={handleDiscard}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800/60 hover:bg-rose-900/40 text-stone-400 hover:text-rose-300 text-xs transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>إلغاء</span>
                      </button>
                    </div>

                    {/* Stop and Save Button */}
                    <button
                      onClick={handleStopAndSave}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-stone-950 text-xs font-bold shadow transition"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>حفظ التسجيل</span>
                    </button>
                  </div>
                </div>

                {/* Scrollable Live Transcription Area */}
                {(recState === 'recording' || recState === 'paused') && (liveResult || liveError) && (
                  <div className="border-t border-stone-800 px-4 py-2 animate-fadeIn">
                    <div className="max-h-32 overflow-y-auto overscroll-contain space-y-2" dir="rtl">
                      {liveResult?.type === 'transcript' && liveResult.text && (
                        <div className="px-2 py-2 rounded-lg bg-stone-950/60 border border-stone-800/60">
                          <div className="text-[11px] text-stone-200 leading-6 font-amiri text-right">
                            {liveResult.text}
                          </div>
                        </div>
                      )}

                      {liveError && (
                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-950/20 border border-amber-800/30">
                          <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="text-[10px] text-amber-300">{liveError}</span>
                        </div>
                      )}

                      {recState === 'recording' && (
                        <div className="flex items-center gap-1.5 px-1 text-[9px] text-stone-500">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          <span>جاري التحويل إلى نص...</span>
                          {liveResult?.transcription_ms != null && (
                            <span className="mr-auto text-stone-600">{liveResult.transcription_ms}ms</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* List of Saved Recordings for this Page */}
            {pageRecordings.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs text-stone-400 font-medium">
                  <span>تسجيلاتك لهذه الصفحة ({pageRecordings.length})</span>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 divide-y divide-stone-800/40">
                  {pageRecordings.map((recording, idx) => {
                    const isThisPlaying = activePlaybackId === recording.id && isPlaying;
                    return (
                      <div
                        key={recording.id}
                        className="pt-1.5 flex items-center justify-between gap-2 text-xs bg-stone-950/40 px-3 py-2 rounded-lg border border-stone-800/80"
                      >
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => handlePlayRecording(recording)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                              isThisPlaying
                                ? 'bg-amber-500 text-stone-950'
                                : 'bg-stone-800 text-amber-400 hover:bg-stone-700'
                            }`}
                            title={isThisPlaying ? "إيقاف مؤقت" : "تشغيل التسجيل"}
                          >
                            {isThisPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                          </button>

                          <div>
                            <div className="font-semibold text-stone-200">
                              تلاوة #{pageRecordings.length - idx} • {formatTime(recording.duration)}
                            </div>
                            <div className="text-[10px] text-stone-500">
                              {new Date(recording.createdAt).toLocaleDateString('ar-EG', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Actions: Analyze, Download & Delete */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleAnalyzeRecording(recording)}
                            disabled={analyzingId === recording.id}
                            className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-stone-800 transition disabled:opacity-50"
                            title="تحليل التلاوة بالذكاء الاصطناعي"
                          >
                            {analyzingId === recording.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => downloadRecordingAudio(recording)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition"
                            title="تحميل الملف الصوتي"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecording(recording.id)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-stone-800 transition"
                            title="حذف التسجيل"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Analyzing spinner */}
                {analyzingId && (
                  <div className="flex items-center justify-center gap-2 py-2 text-xs text-stone-300 animate-fadeIn">
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                    <span className="font-semibold">جاري تحليل التلاوة والتعرف على الموضع...</span>
                  </div>
                )}

                {/* AI Analysis error */}
                {analysisError && (
                  <div className="mt-2 rounded-xl border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-[11px] text-rose-200">
                    {analysisError}
                  </div>
                )}

                {/* AI Analysis result */}
                {analysis && !analyzingId && (
                  <div className="mt-2 rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-3 space-y-3 animate-fadeIn">
                    {/* Current page info */}
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-stone-950/40 border border-stone-800/60">
                      <BookOpen className="w-4 h-4 text-stone-400 shrink-0" />
                      <div className="text-[11px]">
                        <span className="text-stone-400">الصفحة الحالية: </span>
                        <span className="text-stone-200">صفحة {analysis.page} — سورة {metadata.surahName}</span>
                      </div>
                    </div>

                    {/* Detected location */}
                    {analysis.detected && analysis.detected_surah_name && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-950/30 border border-amber-700/40">
                        <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                        <div className="text-[11px] flex-1">
                          <span className="text-stone-400">موضع التلاوة المكتشف: </span>
                          <span className="text-amber-200 font-bold">
                            سورة {analysis.detected_surah_name}
                            {analysis.detected_start_ayah != null && analysis.detected_end_ayah != null && (
                              analysis.detected_start_ayah === analysis.detected_end_ayah
                                ? ` — الآية ${analysis.detected_start_ayah}`
                                : ` — الآيات ${analysis.detected_start_ayah}–${analysis.detected_end_ayah}`
                            )}
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-400 shrink-0">
                          درجة الثقة: {analysis.confidence}%
                        </div>
                      </div>
                    )}

                    {!analysis.detected && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-950/30 border border-amber-700/40">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <div className="text-[11px] text-amber-200">
                          تعذر تحديد موضع التلاوة — لم نتمكن من مطابقة التسجيل مع آيات القرآن بدقة كافية.
                          <br />
                          <span className="text-amber-300/60">يرجى إعادة التسجيل بصوت أوضح.</span>
                        </div>
                      </div>
                    )}

                    {/* Accuracy & Metrics */}
                    {analysis.detected && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                            <CircleCheck className="w-4 h-4" />
                            <span>نسبة التطابق</span>
                          </div>
                          <span className="text-[11px] text-stone-400">{analysis.accuracy}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-stone-800 overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all" style={{width: `${analysis.accuracy}%`}} />
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div className="rounded-lg bg-stone-950/60 p-2">
                            <span className="text-stone-500 block">WER (نسبة أخطاء الكلمات)</span>
                            <span className="text-stone-200 font-bold">{analysis.wer == null ? '—' : `${(analysis.wer * 100).toFixed(1)}%`}</span>
                          </div>
                          <div className="rounded-lg bg-stone-950/60 p-2">
                            <span className="text-stone-500 block">CER (نسبة أخطاء الحروف)</span>
                            <span className="text-stone-200 font-bold">{analysis.cer == null ? '—' : `${(analysis.cer * 100).toFixed(1)}%`}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Per-Ayah Errors */}
                    {analysis.detected && analysis.ayah_errors.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-stone-300">تفاصيل الأخطاء:</span>
                        {analysis.ayah_errors.map((ayahErr) => (
                          <div
                            key={ayahErr.ayah_number}
                            className={`rounded-lg border p-2 text-[10px] ${
                              ayahErr.status === 'correct'
                                ? 'bg-emerald-950/20 border-emerald-700/30'
                                : ayahErr.status === 'missing'
                                ? 'bg-rose-950/20 border-rose-700/30'
                                : 'bg-amber-950/20 border-amber-700/30'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-stone-200">
                                الآية {ayahErr.ayah_number}
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                                ayahErr.status === 'correct'
                                  ? 'bg-emerald-800/40 text-emerald-300'
                                  : ayahErr.status === 'missing'
                                  ? 'bg-rose-800/40 text-rose-300'
                                  : 'bg-amber-800/40 text-amber-300'
                              }`}>
                                {ayahErr.status === 'correct' ? '✅ صحيحة' : ayahErr.status === 'missing' ? '❌ ناقصة' : '⚠️ يوجد خطأ'}
                              </span>
                            </div>

                            {ayahErr.errors.length > 0 && (
                              <div className="space-y-1 mt-1.5">
                                {ayahErr.errors.map((err, eidx) => (
                                  <div key={eidx} className="text-stone-300 leading-4">
                                    {err.message}
                                  </div>
                                ))}
                              </div>
                            )}

                            {ayahErr.ayah_wer != null && (
                              <div className="mt-1 text-stone-500">
                                WER: {(ayahErr.ayah_wer * 100).toFixed(0)}% — CER: {ayahErr.ayah_cer != null ? `${(ayahErr.ayah_cer * 100).toFixed(0)}%` : '—'}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Expected vs Actual Text */}
                    {analysis.detected && analysis.reference && (
                      <div className="grid grid-cols-1 gap-2 text-[10px]">
                        <div className="rounded-lg bg-stone-950/60 p-2">
                          <span className="text-stone-500 block mb-1">النص القرآني الصحيح</span>
                          <span className="text-stone-200 leading-5" dir="rtl">{analysis.reference}</span>
                        </div>
                        <div className="rounded-lg bg-stone-950/60 p-2">
                          <span className="text-stone-500 block mb-1">النص المستخرج من التسجيل</span>
                          <span className="text-stone-200 leading-5" dir="rtl">{analysis.transcription || 'لم يتم التعرف على كلام واضح'}</span>
                        </div>
                      </div>
                    )}

                    {/* Transcription (when not detected) */}
                    {!analysis.detected && (
                      <div className="rounded-lg bg-stone-950/60 p-2 text-[10px]">
                        <span className="text-stone-500 block mb-1">النص المستخرج من التسجيل</span>
                        <span className="text-stone-200 leading-5" dir="rtl">{analysis.transcription || 'لم يتم التعرف على كلام واضح'}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
