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
  Check,
  BrainCircuit,
  RefreshCw,
  ExternalLink,
  Mic,
  Sparkles,
  Image as ImageIcon,
  FileText
} from 'lucide-react';
import { ThemeMode } from '../Header/AppHeader';
import { 
  getFastApiConfig, 
  saveFastApiConfig, 
  checkFastApiHealth, 
  FastApiHealthStatus 
} from '../../lib/fastapi-tafsir';
import { 
  getRecitationApiUrl, 
  saveRecitationApiUrl, 
  checkRecitationServerHealth
} from '../../lib/recitation/recitation-service';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  isDoublePage: boolean;
  onToggleDoublePage: (val: boolean) => void;
  viewMode?: 'image' | 'text';
  onViewModeChange?: (mode: 'image' | 'text') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onThemeChange,
  isDoublePage,
  onToggleDoublePage,
  viewMode = 'image',
  onViewModeChange
}) => {
  const [keepAwake, setKeepAwake] = useState(false);
  const [wakeLockSentinel, setWakeLockSentinel] = useState<unknown | null>(null);

  // Active Settings Tab ('display' | 'tafsir' | 'recitation')
  const [activeTab, setActiveTab] = useState<'display' | 'recitation' | 'tafsir'>('display');

  // FastAPI Tafsir Server settings state
  const [fastApiUrl, setFastApiUrl] = useState(() => getFastApiConfig().baseUrl);
  const [fastApiEndpoint, setFastApiEndpoint] = useState(() => getFastApiConfig().endpoint);
  const [fastApiKey, setFastApiKey] = useState(() => getFastApiConfig().apiKey || '');
  const [healthStatus, setHealthStatus] = useState<FastApiHealthStatus | null>(null);
  const [isTestingServer, setIsTestingServer] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Recitation Whisper AI Server settings state
  const [recitationUrl, setRecitationUrl] = useState(() => getRecitationApiUrl());
  const [isRecitationOnline, setIsRecitationOnline] = useState<boolean | null>(null);
  const [recitationMessage, setRecitationMessage] = useState<string | null>(null);
  const [isTestingRecitation, setIsTestingRecitation] = useState(false);
  const [recitationSaved, setRecitationSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getFastApiConfig();
      setFastApiUrl(cfg.baseUrl);
      setFastApiEndpoint(cfg.endpoint);
      setFastApiKey(cfg.apiKey || '');
      handleTestConnection(cfg.baseUrl);

      const recUrl = getRecitationApiUrl();
      setRecitationUrl(recUrl);
      handleTestRecitation(recUrl);
    }
  }, [isOpen]);

  const handleTestConnection = async (urlToTest?: string) => {
    setIsTestingServer(true);
    try {
      const status = await checkFastApiHealth(urlToTest || fastApiUrl);
      setHealthStatus(status);
    } catch {
      setHealthStatus({
        isChecking: false,
        isConnected: false,
        serverUrl: urlToTest || fastApiUrl,
        message: 'تعذر الاتصال بالخادم'
      });
    } finally {
      setIsTestingServer(false);
    }
  };

  const handleTestRecitation = async (urlToTest?: string) => {
    setIsTestingRecitation(true);
    setRecitationMessage(null);
    try {
      const targetUrl = (urlToTest || recitationUrl).trim();
      const res = await checkRecitationServerHealth(targetUrl);
      setIsRecitationOnline(res.isOnline);
      if (res.isOnline) {
        setRecitationMessage(`متصل (${res.latencyMs || 0}ms)`);
      } else {
        setRecitationMessage(res.message || 'تعذر الاتصال بالسيرفر');
      }
    } catch {
      setIsRecitationOnline(false);
      setRecitationMessage('تعذر الاتصال بالسيرفر');
    } finally {
      setIsTestingRecitation(false);
    }
  };

  const handleSaveFastApi = () => {
    saveFastApiConfig({
      baseUrl: fastApiUrl,
      endpoint: fastApiEndpoint,
      apiKey: fastApiKey
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    handleTestConnection(fastApiUrl);
  };

  const handleSaveRecitation = () => {
    saveRecitationApiUrl(recitationUrl);
    setRecitationSaved(true);
    setTimeout(() => setRecitationSaved(false), 2000);
    handleTestRecitation(recitationUrl);
  };

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
        </div>

        {/* Settings Body */}
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Navigation Tabs for Settings */}
          <div className="flex rounded-xl bg-stone-950 p-1 border border-stone-800 text-xs">
            <button
              onClick={() => setActiveTab('display')}
              className={`flex-1 py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'display' ? 'bg-stone-800 text-amber-300 shadow' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>المظهر والعرض</span>
            </button>
            <button
              onClick={() => setActiveTab('recitation')}
              className={`flex-1 py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'recitation' ? 'bg-rose-950/70 border border-rose-600/40 text-rose-200 shadow' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Mic className="w-3.5 h-3.5 text-rose-400" />
              <span>سيرفر تصحيح التلاوة</span>
            </button>
            <button
              onClick={() => setActiveTab('tafsir')}
              className={`flex-1 py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'tafsir' ? 'bg-amber-950/70 border border-amber-600/40 text-amber-200 shadow' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <BrainCircuit className="w-3.5 h-3.5 text-amber-400" />
              <span>سيرفر التفسير</span>
            </button>
          </div>

          {/* TAB 1: DISPLAY & APP SETTINGS */}
          {activeTab === 'display' && (
            <div className="space-y-4 animate-fadeIn">
              {/* View Mode Selection: Scanned Mushaf Image vs Digital Text */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-amber-300 block">
                  طريقة عرض صفحات المصحف:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onViewModeChange?.('image')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition text-center cursor-pointer ${
                      viewMode === 'image'
                        ? 'bg-amber-950/60 border-amber-500 text-amber-200 ring-2 ring-amber-500/50 shadow-md'
                        : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                      <img src="/public/quran.png" alt="المصحف المدني" className="w-9 h-9 object-contain" />
                    </div>
                    <span className="text-xs font-bold">المصحف المدني</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onViewModeChange?.('text')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition text-center cursor-pointer ${
                      viewMode === 'text'
                        ? 'bg-amber-950/60 border-amber-500 text-amber-200 ring-2 ring-amber-500/50 shadow-md'
                        : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                      <img src="/public/digital quran.png" alt="المصحف الرقمي" className="w-9 h-9 object-contain" />
                    </div>
                    <span className="text-xs font-bold">المصحف الرقمي</span>
                  </button>
                </div>
              </div>

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
            </div>
          )}

          {/* TAB 2: RECITATION WHISPER AI SERVER */}
          {activeTab === 'recitation' && (
            <div className="space-y-3.5 animate-fadeIn">
              <div className="p-4 bg-stone-950/80 border border-rose-500/40 rounded-xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-bold text-rose-200">سيرفر تصحيح التلاوة بالذكاء الاصطناعي</span>
                  </div>
                  
                  {isTestingRecitation ? (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400">
                      <RefreshCw className="w-3 h-3 animate-spin" /> فحص...
                    </span>
                  ) : isRecitationOnline ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      متصل
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                      غير متصل
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-medium text-stone-300 block mb-1">
                    رابط سيرفر (Localhost أو رابط السيرفر المباشر):
                  </label>
                  <input
                    type="text"
                    value={recitationUrl}
                    onChange={(e) => setRecitationUrl(e.target.value)}
                    placeholder="http://localhost:8000"
                    className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 font-mono text-xs focus:outline-none focus:border-rose-500"
                    dir="ltr"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveRecitation}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition shadow"
                    >
                      {recitationSaved ? <Check className="w-3.5 h-3.5" /> : null}
                      <span>{recitationSaved ? 'تم الحفظ!' : 'حفظ الرابط'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTestRecitation(recitationUrl)}
                      disabled={isTestingRecitation}
                      className="flex items-center gap-1 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-medium border border-stone-700 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingRecitation ? 'animate-spin' : ''}`} />
                      <span>فحص</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: FASTAPI TAFSIR SERVER */}
          {activeTab === 'tafsir' && (
            <div className="space-y-3.5 animate-fadeIn">
              <div className="p-4 bg-stone-950/70 border border-amber-500/30 rounded-xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-200">سيرفر تفسير الآيات بالذكاء الاصطناعي</span>
                  </div>
                  
                  {isTestingServer ? (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400">
                      <RefreshCw className="w-3 h-3 animate-spin" /> جاري الفحص...
                    </span>
                  ) : healthStatus?.isConnected ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-800/50 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      متصل
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-800/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                      غير متصل
                    </span>
                  )}
                </div>


                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] font-medium text-stone-300 block mb-1">
                      رابط خادم (Host URL):
                    </label>
                    <input
                      type="text"
                      value={fastApiUrl}
                      onChange={(e) => setFastApiUrl(e.target.value)}
                      placeholder="http://localhost:8000 أو https://your-server.com"
                      className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 font-mono text-xs focus:outline-none focus:border-amber-500"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-stone-300 block mb-1">
                      مسار نقطة النهاية (Endpoint Path):
                    </label>
                    <input
                      type="text"
                      value={fastApiEndpoint}
                      onChange={(e) => setFastApiEndpoint(e.target.value)}
                      placeholder="/api/tafsir"
                      className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 font-mono text-xs focus:outline-none focus:border-amber-500"
                      dir="ltr"
                    />
                  </div>

                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveFastApi}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-950 rounded-lg text-xs font-bold transition shadow"
                    >
                      {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
                      <span>{isSaved ? 'تم الحفظ!' : 'حفظ الإعدادات'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTestConnection(fastApiUrl)}
                      disabled={isTestingServer}
                      className="flex items-center gap-1 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-medium border border-stone-700 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingServer ? 'animate-spin' : ''}`} />
                      <span>فحص الاتصال</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          
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
