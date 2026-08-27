import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sun, 
  Moon, 
  Coffee, 
  Smartphone, 
  Monitor, 
  BookOpen, 
  Eye, 
  Keyboard, 
  Info,
  Check
} from 'lucide-react';
import { ThemeMode } from '../Header/AppHeader';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  isDoublePage: boolean;
  onToggleDoublePage: (val: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onThemeChange,
  isDoublePage,
  onToggleDoublePage
}) => {
  const [keepAwake, setKeepAwake] = useState(false);
  const [wakeLockSentinel, setWakeLockSentinel] = useState<unknown | null>(null);

  // Screen WakeLock toggle
  const handleWakeLockToggle = async () => {
    if (!('wakeLock' in navigator)) {
      alert('ميزة إبقاء الشاشة مضاءة غير مدعومة في هذا المتصفح');
      return;
    }

    if (keepAwake) {
      if (wakeLockSentinel && typeof (wakeLockSentinel as { release: () => Promise<void> }).release === 'function') {
        await (wakeLockSentinel as { release: () => Promise<void> }).release();
      }
      setWakeLockSentinel(null);
      setKeepAwake(false);
    } else {
      try {
        const sentinel = await (navigator as unknown as { wakeLock: { request: (type: string) => Promise<unknown> } }).wakeLock.request('screen');
        setWakeLockSentinel(sentinel);
        setKeepAwake(true);
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md flex flex-col bg-stone-900 text-stone-100 border border-stone-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 bg-stone-900/90">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold font-amiri text-amber-200">خيارات وإعدادات القراءة</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Theme Selection */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-stone-400 block">نمط ومظهر المصحف</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onThemeChange('light')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                  theme === 'light'
                    ? 'bg-amber-950/40 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                    : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:bg-stone-800/60 hover:text-stone-200'
                }`}
              >
                <Sun className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold">نهاري (عاجي)</span>
              </button>

              <button
                onClick={() => onThemeChange('sepia')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                  theme === 'sepia'
                    ? 'bg-amber-950/40 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                    : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:bg-stone-800/60 hover:text-stone-200'
                }`}
              >
                <Coffee className="w-5 h-5 text-amber-600" />
                <span className="text-xs font-bold">داكن دافئ</span>
              </button>

              <button
                onClick={() => onThemeChange('dark')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                  theme === 'dark'
                    ? 'bg-amber-950/40 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                    : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:bg-stone-800/60 hover:text-stone-200'
                }`}
              >
                <Moon className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-bold">ليلي (مظلم)</span>
              </button>
            </div>
          </div>

          {/* Desktop Double-Page Spread */}
          <div className="p-3.5 bg-stone-950/60 border border-stone-800 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-stone-200 block">عرض صفحتين متقابلتين</span>
              <span className="text-[11px] text-stone-400">على الشاشات الكبيرة وأجهزة الحاسوب</span>
            </div>
            <button
              onClick={() => onToggleDoublePage(!isDoublePage)}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                isDoublePage ? 'bg-amber-600' : 'bg-stone-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  isDoublePage ? '-translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Screen Wake Lock */}
          <div className="p-3.5 bg-stone-950/60 border border-stone-800 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-stone-200 block">إبقاء الشاشة نشطة أثناء التلاوة</span>
              <span className="text-[11px] text-stone-400">منع إغلاق الشاشة تلقائياً أثناء القراءة</span>
            </div>
            <button
              onClick={handleWakeLockToggle}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                keepAwake ? 'bg-amber-600' : 'bg-stone-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  keepAwake ? '-translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Shortcuts info */}
          <div className="p-3.5 bg-stone-950/40 border border-stone-800/80 rounded-xl space-y-2 text-xs text-stone-400">
            <div className="flex items-center gap-1.5 font-bold text-stone-300">
              <Keyboard className="w-4 h-4 text-amber-400" />
              <span>طرق التنقل السريعة</span>
            </div>
            <ul className="space-y-1 list-disc list-inside text-[11px] text-stone-400">
              <li>السحب باللمس لليمين أو اليسار على الهواتف</li>
              <li>الأسهم (السهم الأيسر: التالي، السهم الأيمن: السابق)</li>
              <li>زر المسافة (Space) للانتقال للصفحة التالية</li>
            </ul>
          </div>

          {/* Quran Edition Info */}
          <div className="p-3.5 bg-amber-950/20 border border-amber-900/30 rounded-xl text-xs text-amber-200/80 space-y-1">
            <div className="font-bold font-amiri text-amber-300">طبعة مجمع الملك فهد لطباعة المصحف الشريف</div>
            <p className="text-[11px] leading-relaxed text-stone-400">
              برواية حفص عن عاصم بالرسم العثماني، 604 صفحات مطابقة للمصحف المطبوع بالمدينة المنورة.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-stone-950 border-t border-stone-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
