import React, { useState, useEffect } from 'react';
import { 
  Server, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Copy, 
  Check, 
  Cpu, 
  Radio, 
  Volume2,
  Download,
  ExternalLink,
  Zap,
  Sparkles
} from 'lucide-react';
import { 
  getRecitationApiUrl, 
  setRecitationApiUrl, 
  checkRecitationServerHealth
} from '../../lib/recitation/recitation-service';

interface RecitationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RecitationSettingsModal: React.FC<RecitationSettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [apiUrl, setApiUrl] = useState<string>('http://localhost:8000');
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [serverStatus, setServerStatus] = useState<{
    isOnline: boolean;
    model?: string;
    device?: string;
    latencyMs?: number;
    message?: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'connect' | 'colab'>('connect');

  useEffect(() => {
    if (isOpen) {
      const url = getRecitationApiUrl() || 'http://localhost:8000';
      setApiUrl(url);
      handleCheckHealth(url);
    }
  }, [isOpen]);

  const handleCheckHealth = async (urlToCheck?: string) => {
    const url = (urlToCheck !== undefined ? urlToCheck : apiUrl).trim() || 'http://localhost:8000';
    setIsChecking(true);
    setServerStatus(null);
    try {
      const res = await checkRecitationServerHealth(url);
      setServerStatus(res);
    } catch {
      setServerStatus({
        isOnline: false,
        message: 'تعذر الاتصال بسيرفر Whisper'
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleSaveUrl = () => {
    const trimmed = apiUrl.trim() || 'http://localhost:8000';
    setRecitationApiUrl(trimmed);
    setApiUrl(trimmed);
    handleCheckHealth(trimmed);
  };

  const handleDownloadNotebook = () => {
    const a = document.createElement('a');
    a.href = '/recitation_server.ipynb';
    a.download = 'recitation_server.ipynb';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
      dir="rtl"
    >
      <div 
        className="relative w-full max-w-xl p-5 sm:p-7 rounded-3xl bg-stone-900 border border-stone-700/80 text-stone-100 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                محرك التلاوة المخصص (Whisper LoRA)
              </h2>
              <p className="text-xs text-stone-400">
                موديل Hugging Face: <span className="text-amber-400 font-mono font-bold">KheemP/whisper-base-quran-lora</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white rounded-xl hover:bg-stone-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-950 p-1 border border-stone-800">
          <button
            onClick={() => setActiveTab('connect')}
            className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'connect'
                ? 'bg-amber-600 text-stone-950 shadow'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">الاتصال بالسيرفر</span>
          </button>
          <button
            onClick={() => setActiveTab('colab')}
            className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'colab'
                ? 'bg-amber-600 text-stone-950 shadow'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Colab GPU 🚀</span>
          </button>
        </div>

        {/* TAB 1: Connect */}
        {activeTab === 'connect' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Active Model Info Card */}
            <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Cpu className="w-4 h-4" />
                  <span>الموديل الحصري المعتمد للتلاوة</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                  LoRA Fine-Tuned
                </span>
              </div>
              <p className="text-xs text-stone-300">
                يعتمد التطبيق حصرياً على موديل <span className="font-mono text-amber-300 font-bold">KheemP/whisper-base-quran-lora</span> المدرب خصيصاً على القرآن الكريم لتفريغ التلاوة بدقة عالية وبدون أي موديل بديل.
              </p>
            </div>

            {/* Server URL Input */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-stone-300 block">
                عنوان سيرفر بايثون (Localhost أو رابط Colab / ngrok):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="http://localhost:8000 أو https://xxxx.loca.lt"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  dir="ltr"
                />
                <button
                  onClick={handleSaveUrl}
                  disabled={isChecking}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold rounded-xl text-xs transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  {isChecking ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Server className="w-4 h-4" />
                  )}
                  <span>حفظ واختبار</span>
                </button>
              </div>
            </div>

            {/* Health status indicator */}
            {serverStatus && (
              <div
                className={`p-4 rounded-2xl border text-xs space-y-2 transition ${
                  serverStatus.isOnline
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/30 border-red-500/30 text-red-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-2">
                    {serverStatus.isOnline ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                    )}
                    <span>
                      {serverStatus.isOnline
                        ? 'سيرفر Whisper متصل وجاهز للتقييم'
                        : 'سيرفر Whisper غير متصل'}
                    </span>
                  </div>
                  {serverStatus.latencyMs !== undefined && (
                    <span className="text-[11px] font-mono opacity-80">
                      {serverStatus.latencyMs}ms
                    </span>
                  )}
                </div>
                <p className="text-[11px] opacity-90">{serverStatus.message}</p>
                {serverStatus.isOnline && (
                  <div className="pt-2 border-t border-emerald-500/20 flex items-center gap-4 text-[11px] font-mono">
                    <div>
                      الموديل: <b className="text-white">{serverStatus.model}</b>
                    </div>
                    <div>
                      المعالجة: <b className="text-white">{serverStatus.device}</b>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Colab Notebook */}
        {activeTab === 'colab' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 to-stone-900 border border-amber-500/40 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>تشغيل الموديل على كارت شاشة Nvidia T4 مجاناً عبر Colab</span>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed">
                إذا لم يكن لديك كارت شاشة Nvidia قوي على جهازك، يمكنك تشغيل موديل التلاوة بالكامل على كروت شاشة Google Colab المجانية مع رابط HTTPS مباشر.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={handleDownloadNotebook}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs transition shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل ملف النوت بوك (recitation_server.ipynb)</span>
                </button>
                <a
                  href="https://colab.research.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold rounded-xl text-xs transition border border-stone-700"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>فتح Google Colab</span>
                </a>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-3 text-xs leading-relaxed">
              <div className="flex items-center gap-2 font-bold text-amber-400">
                <Zap className="w-4 h-4" />
                <span>خطوات التشغيل البسيطة:</span>
              </div>
              <ol className="list-decimal list-inside space-y-2 text-stone-300 text-[11px]">
                <li>اضغط على <b>"تحميل ملف النوت بوك"</b> بالأعلى لحفظ ملف <span className="text-amber-400 font-semibold font-mono">recitation_server.ipynb</span> على جهازك.</li>
                <li>افتح موقع <a href="https://colab.research.google.com/" target="_blank" rel="noreferrer" className="text-amber-400 underline font-semibold">Google Colab</a> ثم اختر <b>Upload (رفع)</b> وارفع الملف.</li>
                <li>من القائمة العلوية في Colab: اختر <b>Runtime ⬅️ Change runtime type</b> ثم اختر <b>T4 GPU</b> واضغط <b>Save</b>.</li>
                <li>اضغط على <b>Runtime ⬅️ Run all (تشغيل الكل)</b>؛ سيتم تجهيز الموديل وتوليد رابط مباشر (مثل <span className="text-amber-400 font-mono">https://xxxx.loca.lt</span>).</li>
                <li>انسخ هذا الرابط وضعه في خانة <b>"الاتصال بالسيرفر"</b> في التطبيق، وستتحول التلاوة للسرعة الفائقة!</li>
              </ol>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-stone-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold rounded-xl text-xs transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
