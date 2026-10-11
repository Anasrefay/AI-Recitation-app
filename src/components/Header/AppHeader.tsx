import React from 'react';
import { 
  BookOpen, 
  Moon, 
  Sun, 
  Coffee, 
  Maximize, 
  Minimize, 
  Sliders, 
  Eye, 
  EyeOff, 
  BrainCircuit,
  Volume2,
  Image as ImageIcon,
  FileText
} from 'lucide-react';
import { PageMetadata } from '../../data/pages-metadata';
import { QuranAiLogo } from './QuranAiLogo';

export type ThemeMode = 'light' | 'dark' | 'sepia';

interface AppHeaderProps {
  metadata: PageMetadata;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  onOpenIndex: (initialTab?: 'surah' | 'juz') => void;
  onOpenSettings: () => void;
  onOpenTafsir?: () => void;
  onOpenAudioPlayer?: () => void;
  isTextHidden: boolean;
  onToggleHideText: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  viewMode?: 'image' | 'text';
  onToggleViewMode?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  metadata,
  theme,
  onThemeChange,
  onOpenIndex,
  onOpenSettings,
  onOpenTafsir,
  onOpenAudioPlayer,
  isTextHidden,
  onToggleHideText,
  isFullscreen,
  onToggleFullscreen,
  viewMode = 'image',
  onToggleViewMode
}) => {
  const cycleTheme = () => {
    if (theme === 'light') onThemeChange('sepia');
    else if (theme === 'sepia') onThemeChange('dark');
    else onThemeChange('light');
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-stone-900/95 text-stone-100 backdrop-blur-md border-b border-stone-800 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Brand Zone - Custom Quran AI Logo Badge */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
          <div
            className="flex items-center group cursor-pointer"
            onClick={() => onOpenIndex('surah')}
            title="فهرس السور والأجزاء"
          >
            <img src="/QuranLogo.png" alt="صورة المصحف" className="h-8 sm:h-9" />
            <span
              className="ms-2 sm:ms-3 font-ruqaa font-bold text-xl sm:text-2xl leading-normal
                        bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-600
                        bg-clip-text text-transparent
                        drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]
                        group-hover:brightness-110 transition"
            >
              القرآن الكريم
            </span>
          </div>

        </div>

        {/* Navigation Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Index / Search Button */}
          <button
            onClick={() => onOpenIndex('surah')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white border border-stone-700/70 text-xs sm:text-sm font-medium transition whitespace-nowrap"
            title="فهرس السور والأجزاء"
          >
            <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
            <span>الفهرس</span>
          </button>

          {/* AI Tafsir Quick Button */}
          {onOpenTafsir && (
            <button
              onClick={onOpenTafsir}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 hover:text-amber-200 border border-amber-600/40 text-xs sm:text-sm font-medium transition shadow-sm whitespace-nowrap cursor-pointer"
              title="تفسير الآيات بالذكاء الاصطناعي (FastAPI)"
            >
              <BrainCircuit className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">تفسير AI</span>
            </button>
          )}


          {/* Hide/Show Verses Text (Only in text mode, hidden in image mode) */}
          {viewMode !== 'image' && (
            <button
              onClick={onToggleHideText}
              className={`p-1.5 sm:p-2 rounded-lg border transition ${
                isTextHidden
                  ? 'bg-amber-600 hover:bg-amber-500 text-stone-950 border-amber-400 ring-2 ring-amber-400/40 shadow-md'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white border-stone-700/70'
              }`}
              title={
                isTextHidden
                  ? 'إظهار نص الآيات (إيقاف وضع التسميع)'
                  : 'إخفاء نص الآيات للتسميع'
              }
              aria-label="إخفاء أو إظهار نص الآيات"
            >
              {isTextHidden ? (
                <EyeOff className="w-4 h-4 text-stone-950 shrink-0 animate-pulse" />
              ) : (
                <Eye className="w-4 h-4 text-amber-400 shrink-0" />
              )}
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={cycleTheme}
            className="p-1.5 sm:p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700/70 transition"
            title={`تغيير المظهر (${theme === 'light' ? 'نهاري' : theme === 'sepia' ? 'داكن دافئ' : 'ليلي'})`}
            aria-label="تغيير المظهر"
          >
            {theme === 'light' && <Sun className="w-4 h-4 text-amber-400" />}
            {theme === 'sepia' && <Coffee className="w-4 h-4 text-amber-600" />}
            {theme === 'dark' && <Moon className="w-4 h-4 text-indigo-300" />}
          </button>

          {/* Settings / Reading mode */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 sm:p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700/70 transition"
            title="إعدادات القراءة والمظهر وسيرفر FastAPI"
            aria-label="إعدادات القراءة"
          >
            <Sliders className="w-4 h-4 text-stone-300" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={onToggleFullscreen}
            className="hidden sm:flex p-1.5 sm:p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700/70 transition"
            title={isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة للقراءة'}
            aria-label="ملء الشاشة"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
