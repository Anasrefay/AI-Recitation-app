import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PageViewer } from './PageViewer';
import { PageMetadata, getPageMetadata } from '../../data/pages-metadata';
import { ThemeMode } from '../Header/AppHeader';
import { ChevronRight, ChevronLeft, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { PageAyah } from '../../lib/quran-verses';
import { WordMatchStatus, RecitationAnalysisResponse } from '../../lib/recitation/types';

interface MushafContainerProps {
  currentPage: number;
  metadata: PageMetadata;
  theme: ThemeMode;
  isDoublePage: boolean;
  isTextHidden?: boolean;
  onToggleHideText?: () => void;
  onNextPage: () => void;
  onPrevPage: () => void;
  onToggleUI: () => void;
  isUiVisible: boolean;
  onSelectAyahForTafsir?: (ayah: PageAyah) => void;
  recitationWordStatuses?: Record<string, { status: WordMatchStatus; spoken?: string }>;
  latestRecitationAnalysis?: RecitationAnalysisResponse;
  activeLiveWordIds?: Set<string>;
  onClearRecitationHighlights?: () => void;
  viewMode?: 'image' | 'text';
  onToggleViewMode?: () => void;
  isRecording?: boolean;
  onStartRecording?: () => void;
}

export const MushafContainer: React.FC<MushafContainerProps> = ({
  currentPage,
  metadata,
  theme,
  isDoublePage,
  isTextHidden = false,
  onToggleHideText,
  onNextPage,
  onPrevPage,
  onToggleUI,
  isUiVisible,
  onSelectAyahForTafsir,
  recitationWordStatuses,
  latestRecitationAnalysis,
  activeLiveWordIds,
  onClearRecitationHighlights,
  viewMode = 'image',
  onToggleViewMode,
  isRecording = false,
  onStartRecording
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        // In RTL Arabic reading, moving left turns to next page (page + 1)
        onNextPage();
      } else if (e.key === 'ArrowRight') {
        // In RTL Arabic reading, moving right turns to previous page (page - 1)
        onPrevPage();
      } else if (e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        onNextPage();
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        onPrevPage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNextPage, onPrevPage]);

  // Touch swipe handling for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStartX(e.touches[0].clientX);
      setTouchStartY(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    // Only trigger if horizontal swipe is greater than vertical drag and surpasses threshold
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) {
        // Swiped Left -> Go to Next Page in RTL
        onNextPage();
      } else {
        // Swiped Right -> Go to Prev Page in RTL
        onPrevPage();
      }
    }

    setTouchStartX(null);
    setTouchStartY(null);
  };

  // Zoom helpers
  const handleZoomIn = () => setZoomLevel(prev => Math.min(1.4, prev + 0.1));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(0.8, prev - 0.1));
  const handleResetZoom = () => setZoomLevel(1);

  // If double page mode is active, determine the paired page
  // In Madinah Mushaf:
  // Right page is Odd (1, 3, 5...), Left page is Even (2, 4, 6...)
  const isRightPage = currentPage % 2 !== 0;
  const leftPageNum = isRightPage ? currentPage + 1 : currentPage;
  const rightPageNum = isRightPage ? currentPage : currentPage - 1;

  const leftPageMeta = leftPageNum <= 604 ? getPageMetadata(leftPageNum) : null;
  const rightPageMeta = rightPageNum >= 1 ? getPageMetadata(rightPageNum) : null;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative flex-1 w-full min-h-[calc(100vh-70px)] flex flex-col items-center justify-start sm:justify-center py-2 sm:py-4 px-1.5 sm:px-4 select-none overflow-x-hidden"
    >
      {/* Desktop Quick Next / Prev Float Buttons */}
      <button
        onClick={onPrevPage}
        disabled={currentPage <= 1}
        className="hidden md:flex fixed right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-stone-900/80 hover:bg-stone-800 text-stone-200 border border-stone-700/80 shadow-xl items-center justify-center transition disabled:opacity-20 disabled:pointer-events-none"
        title="الصفحة السابقة (السهم الأيمن)"
        aria-label="الصفحة السابقة"
      >
        <ChevronRight className="w-6 h-6 text-amber-400" />
      </button>

      <button
        onClick={onNextPage}
        disabled={currentPage >= 604}
        className="hidden md:flex fixed left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-stone-900/80 hover:bg-stone-800 text-stone-200 border border-stone-700/80 shadow-xl items-center justify-center transition disabled:opacity-20 disabled:pointer-events-none"
        title="الصفحة التالية (السهم الأيسر)"
        aria-label="الصفحة التالية"
      >
        <ChevronLeft className="w-6 h-6 text-amber-400" />
      </button>

      {/* Pages Container */}
      <div className="w-full flex items-start justify-center gap-4 max-w-6xl">
        {isDoublePage && window.innerWidth > 1024 && rightPageMeta && leftPageMeta ? (
          // Two-page spread (Right & Left)
          <div className="w-full flex items-center justify-center gap-2 lg:gap-6">
            {/* Right Page (Odd) */}
            <PageViewer
              pageNumber={rightPageMeta.pageNumber}
              metadata={rightPageMeta}
              theme={theme}
              isDoublePageSpread={true}
              zoomLevel={zoomLevel}
              isTextHidden={isTextHidden}
              onToggleHideText={onToggleHideText}
              onSelectAyahForTafsir={onSelectAyahForTafsir}
              recitationWordStatuses={recitationWordStatuses}
              activeLiveWordIds={activeLiveWordIds}
              onClearRecitationHighlights={onClearRecitationHighlights}
              onAutoNextPage={onNextPage}
              viewMode={viewMode}
              onToggleViewMode={onToggleViewMode}
              isRecording={isRecording}
              onStartRecording={onStartRecording}
            />
            {/* Left Page (Even) */}
            <PageViewer
              pageNumber={leftPageMeta.pageNumber}
              metadata={leftPageMeta}
              theme={theme}
              isDoublePageSpread={true}
              zoomLevel={zoomLevel}
              isTextHidden={isTextHidden}
              onToggleHideText={onToggleHideText}
              onSelectAyahForTafsir={onSelectAyahForTafsir}
              recitationWordStatuses={recitationWordStatuses}
              activeLiveWordIds={activeLiveWordIds}
              onClearRecitationHighlights={onClearRecitationHighlights}
              onAutoNextPage={onNextPage}
              viewMode={viewMode}
              onToggleViewMode={onToggleViewMode}
              isRecording={isRecording}
              onStartRecording={onStartRecording}
            />
          </div>
        ) : (
          // Single Page View (Default & Mobile)
          <div className="w-full flex justify-center">
            <PageViewer
              pageNumber={currentPage}
              metadata={metadata}
              theme={theme}
              isDoublePageSpread={false}
              zoomLevel={zoomLevel}
              isTextHidden={isTextHidden}
              onToggleHideText={onToggleHideText}
              onSelectAyahForTafsir={onSelectAyahForTafsir}
              recitationWordStatuses={recitationWordStatuses}
              latestRecitationAnalysis={latestRecitationAnalysis}
              activeLiveWordIds={activeLiveWordIds}
              onClearRecitationHighlights={onClearRecitationHighlights}
              onAutoNextPage={onNextPage}
              viewMode={viewMode}
              onToggleViewMode={onToggleViewMode}
              isRecording={isRecording}
              onStartRecording={onStartRecording}
            />
          </div>
        )}
      </div>

      {/* Floating Zoom Tool Widget */}
      {zoomLevel !== 1 && (
        <div className="fixed bottom-24 left-6 z-20 flex items-center gap-1 p-1 bg-stone-900/90 border border-stone-700 rounded-xl shadow-lg backdrop-blur">
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-300 hover:text-white"
            title="تكبير"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-300 hover:text-white text-xs font-mono"
            title="إعادة ضبط الحجم"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-300 hover:text-white"
            title="تصغير"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
