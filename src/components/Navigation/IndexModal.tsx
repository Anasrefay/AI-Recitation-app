import React, { useState, useMemo } from 'react';
import { X, Search, BookOpen, Layers, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { quranData } from '../../lib/quran-data';
import { SURAHS, Surah } from '../../data/surahs';
import { JUZ_LIST, JuzInfo } from '../../data/juz';

interface IndexModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: number;
  onSelectPage: (pageNumber: number) => void;
  initialTab?: 'surah' | 'juz';
}

export const IndexModal: React.FC<IndexModalProps> = ({
  isOpen,
  onClose,
  currentPage,
  onSelectPage,
  initialTab = 'surah'
}) => {
  const [activeTab, setActiveTab] = useState<'surah' | 'juz'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [customPageInput, setCustomPageInput] = useState('');

  const filteredSurahs = useMemo(() => {
    return quranData.searchSurahs(searchQuery);
  }, [searchQuery]);

  const filteredJuz = useMemo(() => {
    if (!searchQuery.trim()) return JUZ_LIST;
    const q = searchQuery.trim();
    return JUZ_LIST.filter(j => 
      j.name.includes(q) || 
      j.arabicName.includes(q) || 
      j.startSurahName.includes(q) || 
      String(j.id) === q || 
      String(j.startPage) === q
    );
  }, [searchQuery]);

  if (!isOpen) return null;

  const handleCustomPageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(customPageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= 604) {
      onSelectPage(pageNum);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-stone-900 text-stone-100 border border-stone-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 bg-stone-900/90">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold font-amiri text-amber-200">فهرس المصحف الشريف</h2>
          </div>
        </div>

        {/* Quick Page Jump Bar */}
        <div className="px-5 pt-3 pb-2 bg-stone-950/60 border-b border-stone-800">
          <form onSubmit={handleCustomPageSubmit} className="flex items-center gap-2">
            <span className="text-xs font-medium text-stone-400 whitespace-nowrap">انتقال سريع لصفحة:</span>
            <input
              type="number"
              min="1"
              max="604"
              placeholder="1 - 604"
              value={customPageInput}
              onChange={(e) => setCustomPageInput(e.target.value)}
              className="w-24 px-3 py-1.5 text-sm bg-stone-800 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 text-center"
            />
            <button
              type="submit"
              disabled={!customPageInput || parseInt(customPageInput, 10) < 1 || parseInt(customPageInput, 10) > 604}
              className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:hover:bg-amber-600 text-stone-950 rounded-lg transition whitespace-nowrap"
            >
              ذهاب
            </button>
            <span className="text-xs text-stone-500 mr-auto">
              (الصفحة الحالية: <strong className="text-amber-400">{currentPage}</strong>)
            </span>
          </form>
        </div>

        {/* Search & Tabs */}
        <div className="p-4 space-y-3 bg-stone-900 border-b border-stone-800">
          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-stone-950 rounded-xl border border-stone-800">
            <button
              onClick={() => setActiveTab('surah')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === 'surah'
                  ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>فهرس السور (114 سورة)</span>
            </button>
            <button
              onClick={() => setActiveTab('juz')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === 'juz'
                  ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>فهرس الأجزاء (30 جزءاً)</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="text"
              placeholder={activeTab === 'surah' ? "ابحث عن اسم السورة (مثل: البقرة، الكهف، يس...)" : "ابحث عن رقم أو اسم الجزء..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 bg-stone-950 border border-stone-800 rounded-xl text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-white"
              >
                مسح
              </button>
            )}
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-stone-800/60 max-h-[50vh]">
          {activeTab === 'surah' ? (
            filteredSurahs.length === 0 ? (
              <div className="py-12 text-center text-stone-400 text-sm">
                لم يتم العثور على سور مطابقة للبحث "{searchQuery}"
              </div>
            ) : (
              filteredSurahs.map((surah) => {
                const isCurrent = currentPage >= surah.startPage && (
                  surah.id === 114 || (SURAHS[surah.id]?.startPage > currentPage)
                );

                return (
                  <div
                    key={surah.id}
                    onClick={() => {
                      onSelectPage(surah.startPage);
                      onClose();
                    }}
                    className={`pt-2 pb-2 px-3 flex items-center justify-between rounded-xl cursor-pointer transition ${
                      isCurrent
                        ? 'bg-amber-950/40 border border-amber-800/60 text-amber-200'
                        : 'hover:bg-stone-800/70 text-stone-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0">
                        {surah.id}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-amiri font-bold text-lg text-amber-100">سورة {surah.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            surah.revelationType === 'مكية'
                              ? 'bg-amber-900/40 text-amber-300 border border-amber-700/40'
                              : 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40'
                          }`}>
                            {surah.revelationType}
                          </span>
                        </div>
                        <p className="text-xs text-stone-400">
                          {surah.ayahsCount} آيات • الجزء {surah.juz}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <span className="text-xs text-stone-400 block">الصفحة</span>
                        <span className="text-sm font-bold text-amber-400">{surah.startPage}</span>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center text-stone-400 group-hover:text-white">
                        <ArrowLeft className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            filteredJuz.length === 0 ? (
              <div className="py-12 text-center text-stone-400 text-sm">
                لم يتم العثور على أجزاء مطابقة للبحث
              </div>
            ) : (
              filteredJuz.map((juz) => {
                const isCurrent = currentPage >= juz.startPage && currentPage <= juz.endPage;

                return (
                  <div
                    key={juz.id}
                    onClick={() => {
                      onSelectPage(juz.startPage);
                      onClose();
                    }}
                    className={`pt-2.5 pb-2.5 px-3 flex items-center justify-between rounded-xl cursor-pointer transition ${
                      isCurrent
                        ? 'bg-amber-950/40 border border-amber-800/60 text-amber-200'
                        : 'hover:bg-stone-800/70 text-stone-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0">
                        {juz.id}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-amiri font-bold text-base text-amber-100">{juz.name} ({juz.arabicName})</span>
                        </div>
                        <p className="text-xs text-stone-400 truncate max-w-xs sm:max-w-md">
                          بداية: سورة {juz.startSurahName} - {juz.startAyahText}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <span className="text-xs text-stone-400 block">الصفحات</span>
                        <span className="text-xs font-bold text-amber-400">{juz.startPage} - {juz.endPage}</span>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center text-stone-400">
                        <ArrowLeft className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-stone-950 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
          <span>مصحف المدينة المنورة - رواية حفص عن عاصم</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
