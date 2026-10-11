/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AppHeader, ThemeMode } from './components/Header/AppHeader';
import { MushafContainer } from './components/MushafPage/MushafContainer';
import { IndexModal } from './components/Navigation/IndexModal';
import { RecordingBar } from './components/Recording/RecordingBar';
import { RecordingsListModal } from './components/Recording/RecordingsListModal';
import { OfflineModal } from './components/Offline/OfflineModal';
import { SettingsModal } from './components/Settings/SettingsModal';
import { TafsirModal } from './components/Tafsir/TafsirModal';
import { AyahAudioModal } from './components/Audio/AyahAudioModal';
import { getPageMetadata } from './data/pages-metadata';
import { registerServiceWorker } from './lib/offline/offline-manager';
import { getAllRecordings, getRecordingsByPage } from './lib/recording/storage';
import { PageAyah, getPageVerses } from './lib/quran-verses';
import { Mic, BrainCircuit } from 'lucide-react';
import { WordMatchStatus, RecitationAnalysisResponse } from './lib/recitation/types';

export default function App() {
  // Page number (1 to 604)
  const [currentPage, setCurrentPage] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mushaf_last_page');
      if (saved) {
        const p = parseInt(saved, 10);
        if (!isNaN(p) && p >= 1 && p <= 604) return p;
      }
    }
    return 1;
  });

  // Theme
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mushaf_theme') as ThemeMode;
      if (saved && ['light', 'dark', 'sepia'].includes(saved)) return saved;
    }
    return 'light';
  });

  // Double page layout preference for desktop
  const [isDoublePage, setIsDoublePage] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mushaf_double_page') === 'true';
    }
    return false;
  });

  // Memorization / Testing mode (Hides verses text while keeping ayah numbers visible)
  const [isTextHidden, setIsTextHidden] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mushaf_hide_text') === 'true';
    }
    return false;
  });

  // View Mode: 'image' (authentic King Fahd Mushaf scan) vs 'text' (interactive digital text)
  const [viewMode, setViewMode] = useState<'image' | 'text'>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('mushaf_view_mode') as 'image' | 'text';
      if (s && ['image', 'text'].includes(s)) return s;
    }
    return 'image';
  });

  const handleToggleViewMode = () => {
    setViewMode((prev) => {
      const nextMode = prev === 'image' ? 'text' : 'image';
      localStorage.setItem('mushaf_view_mode', nextMode);
      return nextMode;
    });
  };

  // Recitation Analysis Results by Page
  const [recitationResultsByPage, setRecitationResultsByPage] = useState<
    Record<number, Record<string, { status: WordMatchStatus; spoken?: string }>>
  >({});
  const [recitationAnalysisByPage, setRecitationAnalysisByPage] = useState<
    Record<number, RecitationAnalysisResponse>
  >({});
  const [activeLiveWordIds, setActiveLiveWordIds] = useState<Set<string>>(new Set());

  // Handle Recitation Analysis Result
  const handleRecitationAnalysisResult = useCallback((result: RecitationAnalysisResponse) => {
    setRecitationResultsByPage((prev) => ({
      ...prev,
      [currentPage]: result.wordStatuses
    }));
    setRecitationAnalysisByPage((prev) => ({
      ...prev,
      [currentPage]: result
    }));
  }, [currentPage]);

  // Handle Live Streaming Word Matching
  const handleLiveMatchUpdate = useCallback((wordIds: string[]) => {
    setActiveLiveWordIds(new Set(wordIds));
  }, []);

  // Clear Highlights on Current Page
  const handleClearRecitationHighlights = useCallback(() => {
    setRecitationResultsByPage((prev) => {
      const copy = { ...prev };
      delete copy[currentPage];
      return copy;
    });
    setRecitationAnalysisByPage((prev) => {
      const copy = { ...prev };
      delete copy[currentPage];
      return copy;
    });
    setActiveLiveWordIds(new Set());
  }, [currentPage]);

  // Handle starting recitation: automatically clear past results on the page and hide verses for testing
  const handleStartRecitation = useCallback(() => {
    handleClearRecitationHighlights();
    setIsTextHidden(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mushaf_hide_text', 'true');
    }
  }, [handleClearRecitationHighlights]);

  // Toggle hide text mode
  const handleToggleHideText = useCallback(() => {
    setIsTextHidden(prev => {
      const next = !prev;
      localStorage.setItem('mushaf_hide_text', String(next));
      return next;
    });
  }, []);

  // Modals state
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [indexTab, setIndexTab] = useState<'surah' | 'juz'>('surah');
  const [isActivelyRecording, setIsActivelyRecording] = useState(false);
  const [isRecordingsListOpen, setIsRecordingsListOpen] = useState(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // FastAPI AI Tafsir Modal state
  const [isTafsirOpen, setIsTafsirOpen] = useState(false);
  const [selectedAyahForTafsir, setSelectedAyahForTafsir] = useState<PageAyah | null>(null);

  // Select specific Ayah to interpret via FastAPI AI
  const handleSelectAyahForTafsir = useCallback((ayah: PageAyah) => {
    setSelectedAyahForTafsir(ayah);
    setIsTafsirOpen(true);
  }, []);

  // Quick Open Tafsir for the first Ayah on current page if none is actively selected
  const handleOpenTafsirForCurrentPage = useCallback(async () => {
    try {
      const pageData = await getPageVerses(currentPage);
      if (pageData && pageData.ayahs.length > 0) {
        setSelectedAyahForTafsir(pageData.ayahs[0]);
      }
    } catch {
      // fallback
    }
    setIsTafsirOpen(true);
  }, [currentPage]);

  // EveryAyah Quran Audio Player Modal state
  const [isAudioPlayerOpen, setIsAudioPlayerOpen] = useState(false);
  const [selectedAyahForAudio, setSelectedAyahForAudio] = useState<PageAyah | null>(null);
  const [pageAyahsForAudio, setPageAyahsForAudio] = useState<PageAyah[]>([]);

  // Keep page ayahs updated for audio player
  useEffect(() => {
    let isCurrent = true;
    getPageVerses(currentPage).then((pageData) => {
      if (isCurrent && pageData && pageData.ayahs.length > 0) {
        setPageAyahsForAudio(pageData.ayahs);
        setSelectedAyahForAudio((prev) => {
          if (!prev || !pageData.ayahs.some((a) => a.number === prev.number)) {
            return pageData.ayahs[0];
          }
          return prev;
        });
      }
    }).catch(() => {});
    return () => {
      isCurrent = false;
    };
  }, [currentPage]);

  // Quick Open Audio Player for the first Ayah or selected Ayah on current page
  const handleOpenAudioPlayerForCurrentPage = useCallback(async () => {
    try {
      const pageData = await getPageVerses(currentPage);
      if (pageData && pageData.ayahs.length > 0) {
        setPageAyahsForAudio(pageData.ayahs);
        setSelectedAyahForAudio((prev) => {
          if (!prev || !pageData.ayahs.some((a) => a.number === prev.number)) {
            return pageData.ayahs[0];
          }
          return prev;
        });
      }
    } catch {
      // fallback
    }
    setIsAudioPlayerOpen(true);
  }, [currentPage]);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Connectivity
  const [isOnline, setIsOnline] = useState(true);

  // Recording stats
  const [recordingsOnPageCount, setRecordingsOnPageCount] = useState(0);
  const [totalRecordingsCount, setTotalRecordingsCount] = useState(0);

  // Focus reading mode (toggle bars)
  const [isUiVisible, setIsUiVisible] = useState(true);

  // Register Service Worker
  useEffect(() => {
    registerServiceWorker();

    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Save page to localStorage
  useEffect(() => {
    localStorage.setItem('mushaf_last_page', String(currentPage));
    refreshRecordingCounts();
  }, [currentPage]);

  // Apply dark mode class to html element
  useEffect(() => {
    localStorage.setItem('mushaf_theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Save double page mode
  const handleToggleDoublePage = (val: boolean) => {
    setIsDoublePage(val);
    localStorage.setItem('mushaf_double_page', String(val));
  };

  // Refresh voice recording counts
  const refreshRecordingCounts = async () => {
    try {
      const pageRecs = await getRecordingsByPage(currentPage);
      setRecordingsOnPageCount(pageRecs.length);

      const allRecs = await getAllRecordings();
      setTotalRecordingsCount(allRecs.length);
    } catch {
      // IndexedDB fallback
    }
  };

  useEffect(() => {
    refreshRecordingCounts();
  }, [currentPage]);

  useEffect(() => {
    if (viewMode !== 'text') {
      setIsActivelyRecording(false);
    }
  }, [viewMode]);

  // Navigation handlers
  const handlePageChange = useCallback((newPage: number) => {
    const clamped = Math.max(1, Math.min(604, newPage));
    setCurrentPage(clamped);
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(604, prev + 1));
  }, []);

  const handlePrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  }, []);

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  const metadata = getPageMetadata(currentPage);

  // Background style based on theme
  const appBg =
    theme === 'light'
      ? 'bg-stone-100'
      : theme === 'sepia'
      ? 'bg-[#ede5cc]'
      : 'bg-stone-950 text-stone-100';

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${appBg}`} dir="rtl">
      {/* Top Bar Header */}
      {isUiVisible && (
        <AppHeader
          metadata={metadata}
          theme={theme}
          onThemeChange={setTheme}
          onOpenIndex={(tab = 'surah') => {
            setIndexTab(tab);
            setIsIndexOpen(true);
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenTafsir={handleOpenTafsirForCurrentPage}
          onOpenAudioPlayer={handleOpenAudioPlayerForCurrentPage}
          isTextHidden={isTextHidden}
          onToggleHideText={handleToggleHideText}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          viewMode={viewMode}
          onToggleViewMode={handleToggleViewMode}
        />
      )}

      {/* Main Mushaf Content Container */}
      <main className="flex-1 flex flex-col items-center justify-center relative">
        <MushafContainer
          currentPage={currentPage}
          metadata={metadata}
          theme={theme}
          isDoublePage={isDoublePage}
          isTextHidden={isTextHidden}
          onToggleHideText={handleToggleHideText}
          onNextPage={handleNextPage}
          onPrevPage={handlePrevPage}
          onToggleUI={() => setIsUiVisible(!isUiVisible)}
          isUiVisible={isUiVisible}
          onSelectAyahForTafsir={handleSelectAyahForTafsir}
          recitationWordStatuses={recitationResultsByPage[currentPage]}
          latestRecitationAnalysis={recitationAnalysisByPage[currentPage]}
          activeLiveWordIds={activeLiveWordIds}
          onClearRecitationHighlights={handleClearRecitationHighlights}
          viewMode={viewMode}
          onToggleViewMode={handleToggleViewMode}
          isRecording={isActivelyRecording}
          onStartRecording={() => {}}
        />
      </main>


      {/* Voice Recording Drawer / Bar */}
      {/* Voice Recording Bar (المصحف الرقمي فقط) */}
      {viewMode === 'text' && (
        <RecordingBar
          currentPage={currentPage}
          metadata={metadata}
          isOpen={true}
          autoStart={false}
          onClose={() => {}}
          onRecordingSaved={refreshRecordingCounts}
          onAnalysisResult={handleRecitationAnalysisResult}
          onLiveMatchUpdate={handleLiveMatchUpdate}
          onStartRecitation={handleStartRecitation}
          onRecordingStateChange={setIsActivelyRecording}
        />
      )}

      {/* Index Modal (Searchable Surahs & Juz) */}
      <IndexModal
        isOpen={isIndexOpen}
        onClose={() => setIsIndexOpen(false)}
        currentPage={currentPage}
        onSelectPage={handlePageChange}
        initialTab={indexTab}
      />

      {/* Recordings Archive Modal */}
      <RecordingsListModal
        isOpen={isRecordingsListOpen}
        onClose={() => setIsRecordingsListOpen(false)}
        onSelectPage={handlePageChange}
      />

      {/* Offline Download Manager Modal */}
      <OfflineModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
        isOnline={isOnline}
        metadata={metadata}
      />

      {/* Settings & Options Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        isDoublePage={isDoublePage}
        onToggleDoublePage={handleToggleDoublePage}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* FastAPI Quran AI Tafsir Modal */}
      <TafsirModal
        isOpen={isTafsirOpen}
        onClose={() => setIsTafsirOpen(false)}
        ayah={selectedAyahForTafsir}
        theme={theme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onAyahChange={setSelectedAyahForTafsir}
      />

      {/* EveryAyah Quran Audio Recitation Modal */}
      <AyahAudioModal
        isOpen={isAudioPlayerOpen}
        onClose={() => setIsAudioPlayerOpen(false)}
        currentAyah={selectedAyahForAudio}
        pageAyahs={pageAyahsForAudio}
        currentPage={currentPage}
        theme={theme}
        onAyahChange={setSelectedAyahForAudio}
        onNextPage={handleNextPage}
        onPrevPage={handlePrevPage}
      />
    </div>
  );
}
