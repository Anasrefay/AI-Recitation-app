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
import { getPageMetadata } from './data/pages-metadata';
import { registerServiceWorker } from './lib/offline/offline-manager';
import { getAllRecordings, getRecordingsByPage } from './lib/recording/storage';
import { Mic } from 'lucide-react';

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
  const [isRecordingBarOpen, setIsRecordingBarOpen] = useState(false);
  const [isRecordingsListOpen, setIsRecordingsListOpen] = useState(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
          isTextHidden={isTextHidden}
          onToggleHideText={handleToggleHideText}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
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
        />
      </main>

      {/* Floating Action Button for One-Tap Voice Recording */}
      {!isRecordingBarOpen && isUiVisible && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-30 animate-bounceOnce">
          <button
            onClick={() => setIsRecordingBarOpen(true)}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-xl shadow-rose-900/30 border border-rose-400/30 transition hover:scale-105 active:scale-95 relative"
            title="تسجيل التلاوة"
            aria-label="تسجيل التلاوة"
          >
            <Mic className="w-5 h-5 text-white" />
            {recordingsOnPageCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-stone-950 text-[10px] flex items-center justify-center font-bold border-2 border-stone-900">
                {recordingsOnPageCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Voice Recording Drawer / Bar */}
      <RecordingBar
        currentPage={currentPage}
        metadata={metadata}
        isOpen={isRecordingBarOpen}
        autoStart={true}
        onClose={() => setIsRecordingBarOpen(false)}
        onRecordingSaved={refreshRecordingCounts}
      />

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
      />
    </div>
  );
}
