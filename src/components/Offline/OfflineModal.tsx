import React, { useState } from 'react';
import { 
  X, 
  Wifi, 
  WifiOff, 
  Download, 
  CheckCircle2, 
  HardDrive, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cachePageRange, CacheProgress } from '../../lib/offline/offline-manager';
import { PageMetadata } from '../../data/pages-metadata';
import { JUZ_LIST } from '../../data/juz';

interface OfflineModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  metadata: PageMetadata;
}

export const OfflineModal: React.FC<OfflineModalProps> = ({
  isOpen,
  onClose,
  isOnline,
  metadata
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<CacheProgress | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentJuzInfo = JUZ_LIST[metadata.juzNumber - 1];

  const handleDownloadJuz = async () => {
    if (!currentJuzInfo) return;
    setIsDownloading(true);
    setDownloadSuccess(false);
    setDownloadError(null);

    try {
      await cachePageRange(currentJuzInfo.startPage, currentJuzInfo.endPage, (prog) => {
        setProgress(prog);
      });
      setDownloadSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تنزيل الصفحات';
      setDownloadError(msg);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    setDownloadSuccess(false);
    setDownloadError(null);

    try {
      await cachePageRange(1, 604, (prog) => {
        setProgress(prog);
      });
      setDownloadSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تنزيل المصحف كاملاً';
      setDownloadError(msg);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg flex flex-col bg-stone-900 text-stone-100 border border-stone-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 bg-stone-900/90">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold font-amiri text-amber-200">القراءة دون اتصال بالإنترنت (PWA)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Connection status badge */}
          <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${
            isOnline
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
              : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
          }`}>
            {isOnline ? (
              <Wifi className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <WifiOff className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <div className="text-xs">
              <span className="font-bold block">
                {isOnline ? 'أنت متصل بالإنترنت حالياً' : 'أنت في وضع عدم الاتصال'}
              </span>
              <span className="text-stone-300">
                {isOnline
                  ? 'يتم حفظ الصفحات التي تقرأها تلقائياً لتعمل دون إنترنت.'
                  : 'يمكنك قراءة الصفحات المحفوظة مسبقاً وسماع تسجيلاتك بدون إنترنت.'}
              </span>
            </div>
          </div>

          {/* Download Options */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              حفظ صفحات المصحف مسبقاً للعمل دون اتصال
            </h3>

            {/* Option 1: Current Juz */}
            <div className="p-3.5 bg-stone-950/60 border border-stone-800 rounded-xl flex items-center justify-between gap-3">
              <div>
                <span className="text-sm font-bold text-stone-200 block">
                  حفظ الجزء الحالي ({metadata.juzNumber} - {currentJuzInfo?.name})
                </span>
                <span className="text-xs text-stone-400">
                  الصفحات من {currentJuzInfo?.startPage} إلى {currentJuzInfo?.endPage} (~20 صفحة)
                </span>
              </div>

              <button
                onClick={handleDownloadJuz}
                disabled={isDownloading || !isOnline}
                className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-amber-300 text-xs font-semibold rounded-lg border border-stone-700 transition flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>حفظ الجزء</span>
              </button>
            </div>

            {/* Option 2: Full Quran */}
            <div className="p-3.5 bg-stone-950/60 border border-stone-800 rounded-xl flex items-center justify-between gap-3">
              <div>
                <span className="text-sm font-bold text-stone-200 block">
                  حفظ المصحف الشريف كاملاً
                </span>
                <span className="text-xs text-stone-400">
                  جميع الصفحات الـ 604 للقراءة في أي وقت بدون شبكة
                </span>
              </div>

              <button
                onClick={handleDownloadAll}
                disabled={isDownloading || !isOnline}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-stone-950 text-xs font-bold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>حفظ الكل (604 صفحة)</span>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          {isDownloading && progress && (
            <div className="p-4 bg-stone-950 border border-amber-500/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-300 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  جاري الحفظ: الصفحة {progress.currentPage} ({progress.completed} من {progress.total})
                </span>
                <span className="font-mono text-amber-400 font-bold">{progress.percentage}%</span>
              </div>
              <div className="w-full h-2 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-150"
                  style={{ width: `${progress.percentage}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Success message */}
          {downloadSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>تم حفظ الصفحات بنجاح في الذاكرة المحلية لجهازك! يمكنك قراءتها الآن دون إنترنت.</span>
            </div>
          )}

          {/* Error message */}
          {downloadError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{downloadError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-stone-950 border-t border-stone-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
