import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Mic, 
  Play, 
  Pause, 
  Trash2, 
  Download, 
  BookOpen, 
  ArrowLeft, 
  Calendar, 
  Clock,
  Music
} from 'lucide-react';
import { getAllRecordings, deleteRecording, downloadRecordingAudio, StoredRecording } from '../../lib/recording/storage';

interface RecordingsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPage: (pageNumber: number) => void;
}

export const RecordingsListModal: React.FC<RecordingsListModalProps> = ({
  isOpen,
  onClose,
  onSelectPage
}) => {
  const [recordings, setRecordings] = useState<StoredRecording[]>([]);
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [filterPage, setFilterPage] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchRecordings = async () => {
    try {
      const records = await getAllRecordings();
      setRecordings(records);
    } catch {
      // IndexedDB fallback
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRecordings();
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
        setActivePlayingId(null);
      }
    }
  }, [isOpen]);

  const handlePlayToggle = (recording: StoredRecording) => {
    if (activePlayingId === recording.id && audioRef.current) {
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

    const url = URL.createObjectURL(recording.blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    setActivePlayingId(recording.id);
    setIsPlaying(true);

    audio.onended = () => {
      setIsPlaying(false);
      setActivePlayingId(null);
    };

    audio.play().catch(() => {
      setIsPlaying(false);
    });
  };

  const handleDelete = async (id: string) => {
    if (activePlayingId === id && audioRef.current) {
      audioRef.current.pause();
      setActivePlayingId(null);
      setIsPlaying(false);
    }
    await deleteRecording(id);
    await fetchRecordings();
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const filtered = recordings.filter(r => {
    if (!filterPage.trim()) return true;
    return String(r.pageNumber) === filterPage.trim() || (r.surahName && r.surahName.includes(filterPage.trim()));
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-stone-900 text-stone-100 border border-stone-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 bg-stone-900/90">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-rose-400" />
            <h2 className="text-lg font-bold font-amiri text-amber-200">سجل تلاواتي المسجلة ({recordings.length})</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Input */}
        <div className="p-4 bg-stone-950/60 border-b border-stone-800">
          <input
            type="text"
            placeholder="تصفية حسب رقم الصفحة أو اسم السورة..."
            value={filterPage}
            onChange={(e) => setFilterPage(e.target.value)}
            className="w-full px-4 py-2 bg-stone-900 border border-stone-700/80 rounded-xl text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Recordings List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[50vh]">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-sm space-y-2">
              <Mic className="w-10 h-10 mx-auto text-stone-600 stroke-[1.5]" />
              <p>لا توجد تسجيلات محفوظة حالياً</p>
              <p className="text-xs text-stone-500">
                يمكنك الضغط على زر "تسجيل" أثناء قراءة أي صفحة لحفظ تلاوتك والاستماع إليها لاحقاً
              </p>
            </div>
          ) : (
            filtered.map((rec) => {
              const isItemPlaying = activePlayingId === rec.id && isPlaying;
              return (
                <div
                  key={rec.id}
                  className="p-3 bg-stone-950/80 hover:bg-stone-950 border border-stone-800/80 rounded-xl flex items-center justify-between gap-3 transition"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handlePlayToggle(rec)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition shadow-md ${
                        isItemPlaying
                          ? 'bg-rose-500 text-white'
                          : 'bg-stone-800 text-amber-400 hover:bg-stone-700'
                      }`}
                      title={isItemPlaying ? "إيقاف مؤقت" : "تشغيل التسجيل"}
                    >
                      {isItemPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-amiri font-bold text-base text-amber-200">
                          الصفحة {rec.pageNumber} {rec.surahName ? `(سورة ${rec.surahName})` : ''}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 font-mono">
                          {formatDuration(rec.duration)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-stone-500 mt-0.5">
                        <span>
                          {new Date(rec.createdAt).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {/* Jump to this page button */}
                    <button
                      onClick={() => {
                        onSelectPage(rec.pageNumber);
                        onClose();
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-semibold border border-stone-700 transition"
                      title="فتح صفحة التلاوة"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                      <span className="hidden sm:inline">فتح الصفحة</span>
                    </button>

                    {/* Download */}
                    <button
                      onClick={() => downloadRecordingAudio(rec)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition"
                      title="تحميل الملف الصوتي"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-stone-800 transition"
                      title="حذف التسجيل"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-stone-950 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
          <span>يتم حفظ جميع التسجيلات محلياً في متصفحك</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
