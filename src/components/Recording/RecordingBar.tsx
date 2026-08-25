import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  Square, 
  Pause, 
  Play, 
  Trash2, 
  Download, 
  RotateCcw, 
  Volume2, 
  AlertCircle,
  Check,
  Music,
  X,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { VoiceRecorder } from '../../lib/recording/recorder';
import { RecordingState, VoiceRecording } from '../../lib/recording/types';
import { saveRecording, getRecordingsByPage, deleteRecording, downloadRecordingAudio, StoredRecording } from '../../lib/recording/storage';
import { PageMetadata } from '../../data/pages-metadata';

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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAutoStartedRef = useRef<boolean>(false);

  // Initialize recorder instance
  useEffect(() => {
    const rec = new VoiceRecorder({
      onStateChange: (state) => setRecState(state),
      onTimeUpdate: (seconds) => setRecDuration(seconds),
      onVolumeChange: (vol) => setVolumeLevel(vol),
      onError: (err) => setErrorMessage(err.message)
    });
    setRecorder(rec);

    return () => {
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
    } else if (recState === 'paused') {
      recorder.resume();
    }
  };

  // Stop and save
  const handleStopAndSave = async () => {
    if (!recorder) return;
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل إيقاف وحفظ التسجيل';
      setErrorMessage(msg);
    }
  };

  // Discard recording
  const handleDiscard = () => {
    if (!recorder) return;
    recorder.discard();
    setRecDuration(0);
    setVolumeLevel(0);
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

    const audioUrl = URL.createObjectURL(recording.blob);
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

  // Delete a recording
  const handleDeleteRecording = async (id: string) => {
    if (activePlaybackId === id && audioRef.current) {
      audioRef.current.pause();
      setActivePlaybackId(null);
      setIsPlaying(false);
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
                  <p className="font-semibold text-amber-300">سجّل تلاوتك الخاصة لهذه الصفحة</p>
                  <p className="text-stone-400 text-[11px]">يتم حفظ التسجيل في المتصفح فقط للاستماع إليه ومراجعته</p>
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
              <div className="bg-stone-950/80 p-4 rounded-xl border border-rose-500/30 space-y-3">
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
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-800">
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

                        {/* Actions: Download & Delete */}
                        <div className="flex items-center gap-1">
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
