import React, { useState } from 'react';
import { 
  ChevronRight, 
  ChevronLeft, 
  ChevronsRight, 
  ChevronsLeft, 
  Mic, 
  BookOpen, 
  Layers,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import { PageMetadata } from '../../data/pages-metadata';
import { toArabicDigits } from '../MushafPage/PageViewer';

interface PageNavigatorProps {
  currentPage: number;
  metadata: PageMetadata;
  isTextHidden?: boolean;
  onToggleHideText?: () => void;
  onPageChange: (pageNumber: number) => void;
  onOpenRecording: () => void;
  isRecordingActive: boolean;
  recordingCountForCurrentPage: number;
  onOpenIndex: (tab: 'surah' | 'juz') => void;
}

export const PageNavigator: React.FC<PageNavigatorProps> = ({
  currentPage,
  metadata,
  isTextHidden = false,
  onToggleHideText,
  onPageChange,
  onOpenRecording,
  isRecordingActive,
  recordingCountForCurrentPage,
  onOpenIndex
}) => {
  const [sliderValue, setSliderValue] = useState(currentPage);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setSliderValue(val);
  };

  const handleSliderCommit = () => {
    setIsScrubbing(false);
    onPageChange(sliderValue);
  };

  return (
    <div className="sticky bottom-0 z-30 w-full bg-stone-900/95 text-stone-100 backdrop-blur-md border-t border-stone-800 px-3 py-2.5 sm:px-6 sm:py-3 transition">
      <div className="max-w-4xl mx-auto flex flex-col gap-2">
        {/* Main Controls Row */}
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Previous Page Button (In Arabic, Previous goes backward 2 -> 1) */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-30 disabled:hover:bg-stone-800 text-stone-200 hover:text-white border border-stone-700 text-xs sm:text-sm font-semibold transition whitespace-nowrap shadow-sm"
            title="الصفحة السابقة"
          >
            <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
            <span>السابق</span>
          </button>

          {/* Center Info and Quick Scrubber */}
          <div className="flex-1 flex items-center justify-center gap-2 sm:gap-4 max-w-lg">
            {/* Quick Surah Click */}
            <button
              onClick={() => onOpenIndex('surah')}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-amber-300 hover:text-amber-200 border border-stone-700/60 text-xs font-amiri font-bold transition whitespace-nowrap"
              title="تغيير السورة"
            >
              <span>سورة {metadata.surahName}</span>
            </button>

            {/* Slider with Current Page */}
            <div className="flex-1 flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="604"
                value={isScrubbing ? sliderValue : currentPage}
                onMouseDown={() => setIsScrubbing(true)}
                onTouchStart={() => setIsScrubbing(true)}
                onChange={handleSliderChange}
                onMouseUp={handleSliderCommit}
                onTouchEnd={handleSliderCommit}
                className="w-full h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400"
                style={{ direction: 'rtl' }}
                title={`الانتقال بالصفحات: ${isScrubbing ? sliderValue : currentPage}`}
              />
              <div className="px-2.5 py-1 rounded-lg bg-stone-800 border border-stone-700/80 text-amber-400 font-bold text-xs sm:text-sm min-w-[54px] text-center font-mono">
                {isScrubbing ? sliderValue : currentPage}
                <span className="text-[10px] text-stone-500 font-normal">/604</span>
              </div>
            </div>

            {/* Quick Juz Click */}
            <button
              onClick={() => onOpenIndex('juz')}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-stone-100 border border-stone-700/60 text-xs font-semibold transition whitespace-nowrap"
              title="تغيير الجزء"
            >
              <span>الجزء {metadata.juzNumber}</span>
            </button>
          </div>

          {/* Next Page Button (In Arabic, Next goes forward 1 -> 2) */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= 604}
            className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-30 disabled:hover:bg-stone-800 text-stone-200 hover:text-white border border-stone-700 text-xs sm:text-sm font-semibold transition whitespace-nowrap shadow-sm"
            title="الصفحة التالية"
          >
            <span>التالي</span>
            <ChevronLeft className="w-4 h-4 text-amber-400 shrink-0" />
          </button>
        </div>

        {/* Mobile quick indicators */}
        <div className="flex sm:hidden items-center justify-between text-[11px] text-stone-400 px-1 pt-1 border-t border-stone-800/60">
          <button onClick={() => onOpenIndex('surah')} className="text-amber-400 font-amiri font-bold hover:underline">
            سورة {metadata.surahName}
          </button>

          {onToggleHideText && (
            <button
              onClick={onToggleHideText}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border transition ${
                isTextHidden
                  ? 'bg-amber-600 text-stone-950 border-amber-400'
                  : 'bg-stone-800 text-stone-300 border-stone-700'
              }`}
            >
              {isTextHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3 text-amber-400" />}
              <span>{isTextHidden ? 'إظهار الآيات' : 'إخفاء الآيات'}</span>
            </button>
          )}

          <span>الجزء {metadata.juzNumber} • الحزب {metadata.hizbNumber}</span>
        </div>
      </div>
    </div>
  );
};
