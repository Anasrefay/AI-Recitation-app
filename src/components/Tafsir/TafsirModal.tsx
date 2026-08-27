import React, { useState, useEffect } from 'react';
import { X, BookOpen, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchAyahTafsir, TafsirData } from '../../lib/tafsir-api';

interface TafsirModalProps {
  isOpen: boolean;
  onClose: () => void;
  surahNumber: number;
  ayahNumber: number;
  surahName: string;
}

export const TafsirModal: React.FC<TafsirModalProps> = ({
  isOpen,
  onClose,
  surahNumber,
  ayahNumber,
  surahName,
}) => {
  const [tafsir, setTafsir] = useState<TafsirData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTafsir = async () => {
    if (!surahNumber || !ayahNumber) return;
    setIsLoading(true);
    setError(null);
    setTafsir(null);
    try {
      const data = await fetchAyahTafsir(surahNumber, ayahNumber);
      setTafsir(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل التفسير');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && surahNumber && ayahNumber) {
      loadTafsir();
    }
  }, [isOpen, surahNumber, ayahNumber]);

  useEffect(() => {
    if (!isOpen) {
      setTafsir(null);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full sm:max-w-xl max-h-[85vh] flex flex-col bg-stone-900 text-stone-100 border border-stone-700/80 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden sm:animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 bg-stone-900/90 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 className="text-base sm:text-lg font-bold font-amiri text-amber-200">
                تفسير القرطبي
              </h2>
              <p className="text-[11px] text-stone-400">
                سورة {surahName} • آية {ayahNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <span className="text-sm text-stone-300 font-amiri">جاري تحميل التفسير...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-400" />
              <p className="text-sm text-rose-200 text-center">{error}</p>
              <button
                onClick={loadTafsir}
                className="flex items-center gap-2 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold border border-stone-700 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                إعادة المحاولة
              </button>
            </div>
          ) : tafsir ? (
            <div className="space-y-4 animate-fadeIn">
              {/* Source label */}
              <div className="flex items-center gap-2 text-xs text-stone-400">
                <span className="px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-700/40 text-amber-300 font-semibold">
                  {tafsir.source}
                </span>
              </div>

              {/* Tafsir text */}
              <div
                className="text-sm sm:text-base leading-[2.2] sm:leading-[2.5] text-stone-200 font-amiri whitespace-pre-wrap text-justify"
                dir="rtl"
              >
                {tafsir.tafsir}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-stone-950 border-t border-stone-800 flex justify-end shrink-0">
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
