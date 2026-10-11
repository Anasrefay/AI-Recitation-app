import React, { useState } from 'react';
import { 
  Sparkles, 
  BookOpen, 
  Layers, 
  Bookmark, 
  Quote, 
  Type, 
  ZoomIn, 
  ZoomOut, 
  Palette, 
  Check, 
  Copy, 
  Volume2, 
  VolumeX, 
  RefreshCw 
} from 'lucide-react';
import { ThemeMode } from '../Header/AppHeader';

export type IslamicFontFamily = 'amiri' | 'scheherazade' | 'naskh' | 'ruqaa';
export type TafsirPaperTheme = 'manuscript' | 'mushaf' | 'dark';

interface IslamicTafsirContentProps {
  rawText: string;
  surahName?: string;
  ayahNumber?: number;
  modelUsed?: string;
  source?: string;
  processingTimeMs?: number;
  theme: ThemeMode;
  onRefresh?: () => void;
  onCopy?: () => void;
  isCopied?: boolean;
  onSpeak?: () => void;
  isSpeaking?: boolean;
}

export const IslamicTafsirContent: React.FC<IslamicTafsirContentProps> = ({
  rawText,
  surahName,
  ayahNumber,
  modelUsed,
  source,
  processingTimeMs,
  theme,
  onRefresh,
  onCopy,
  isCopied = false,
  onSpeak,
  isSpeaking = false
}) => {
  // Font preferences
  const [fontFamily, setFontFamily] = useState<IslamicFontFamily>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mushaf_tafsir_font') as IslamicFontFamily;
      if (['amiri', 'scheherazade', 'naskh', 'ruqaa'].includes(saved)) return saved;
    }
    return 'amiri';
  });

  // Font size multiplier
  const [fontSizeLevel, setFontSizeLevel] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mushaf_tafsir_fontsize');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 3) return parsed;
      }
    }
    return 1; // 0: Small, 1: Normal, 2: Large, 3: Extra Large
  });

  // Paper Theme Preference
  const [paperTheme, setPaperTheme] = useState<TafsirPaperTheme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mushaf_tafsir_paper') as TafsirPaperTheme;
      if (['manuscript', 'mushaf', 'dark'].includes(saved)) return saved;
    }
    return theme === 'dark' ? 'dark' : theme === 'sepia' ? 'manuscript' : 'mushaf';
  });

  const handleSetFont = (font: IslamicFontFamily) => {
    setFontFamily(font);
    localStorage.setItem('mushaf_tafsir_font', font);
  };

  const handleSetFontSize = (delta: number) => {
    setFontSizeLevel((prev) => {
      const next = Math.max(0, Math.min(3, prev + delta));
      localStorage.setItem('mushaf_tafsir_fontsize', String(next));
      return next;
    });
  };

  const handleSetPaperTheme = (paper: TafsirPaperTheme) => {
    setPaperTheme(paper);
    localStorage.setItem('mushaf_tafsir_paper', paper);
  };

  // Font class mapping
  const getFontFamilyClass = () => {
    switch (fontFamily) {
      case 'scheherazade':
        return 'font-scheherazade';
      case 'ruqaa':
        return 'font-ruqaa';
      case 'naskh':
        return 'font-naskh';
      case 'amiri':
      default:
        return 'font-amiri';
    }
  };

  // Font size class mapping
  const getFontSizeClasses = () => {
    switch (fontSizeLevel) {
      case 0: // Small
        return 'text-sm sm:text-base leading-[2.2] sm:leading-[2.4]';
      case 2: // Large
        return 'text-lg sm:text-xl leading-[2.6] sm:leading-[2.9]';
      case 3: // Extra Large
        return 'text-xl sm:text-2xl leading-[2.8] sm:leading-[3.2]';
      case 1: // Normal
      default:
        return 'text-base sm:text-lg leading-[2.4] sm:leading-[2.7]';
    }
  };

  // Paper styling with high-contrast, crystal-clear readability
  const getPaperStyles = () => {
    switch (paperTheme) {
      case 'manuscript':
        return {
          containerClass: 'bg-[#fbf7ed] text-stone-950 border-[#cbb389]',
          headerClass: 'text-amber-950 border-[#cbb389]/60',
          ayahQuoteClass: 'bg-emerald-50 text-emerald-950 border-emerald-400 font-bold',
          bulletClass: 'text-amber-700',
          sectionBannerClass: 'bg-[#edd9af] text-stone-950 border-[#b45309] font-bold shadow-xs',
          scholarlyClass: 'bg-[#f4ebd0] border-r-4 border-amber-700 text-stone-950 border border-amber-300/80',
          boldClass: 'text-stone-950 font-bold',
          normalProseClass: 'text-stone-950'
        };
      case 'mushaf':
        return {
          containerClass: 'bg-[#ffffff] text-stone-950 border-[#d4af37]/60',
          headerClass: 'text-emerald-950 border-stone-200',
          ayahQuoteClass: 'bg-emerald-50 text-emerald-950 border-emerald-400 font-bold',
          bulletClass: 'text-amber-700',
          sectionBannerClass: 'bg-gradient-to-r from-amber-100 via-amber-50 to-amber-100 text-stone-950 border-amber-400/80 font-bold shadow-xs',
          scholarlyClass: 'bg-amber-50/70 border-r-4 border-amber-600 text-stone-950 border border-amber-200',
          boldClass: 'text-stone-950 font-bold',
          normalProseClass: 'text-stone-950'
        };
      case 'dark':
      default:
        return {
          containerClass: 'bg-[#101012] text-[#ffffff] border-amber-600/40',
          headerClass: 'text-amber-300 border-zinc-800',
          ayahQuoteClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/70 font-bold',
          bulletClass: 'text-amber-400',
          sectionBannerClass: 'bg-stone-900/90 text-amber-300 border-amber-500/60 font-bold shadow-sm',
          scholarlyClass: 'bg-stone-900/90 border-r-4 border-amber-500 text-stone-100 border border-stone-800',
          boldClass: 'text-white font-bold',
          normalProseClass: 'text-white'
        };
    }
  };

  const paperStyles = getPaperStyles();

  /**
   * Intelligently parses raw AI text into rich Islamic structured elements
   */
  const renderFormattedTafsir = (text: string) => {
    if (!text) return null;

    // Clean markdown hashes and format lines
    const rawParagraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

    return rawParagraphs.map((paragraph, pIdx) => {
      // 1. Check if paragraph is an Islamic Heading / Section
      const isHeader = 
        paragraph.startsWith('#') || 
        paragraph.startsWith('**المعنى') || 
        paragraph.startsWith('**سبب') || 
        paragraph.startsWith('**اللطائف') || 
        paragraph.startsWith('**الهدايات') || 
        paragraph.startsWith('**الفوائد') || 
        paragraph.startsWith('**أقوال') || 
        paragraph.startsWith('**الدروس') || 
        paragraph.startsWith('**الإعراب') || 
        paragraph.startsWith('**تفسير') ||
        /^(\*\*|#+\s*).*(\*\*|:)\s*$/.test(paragraph.trim());

      if (isHeader) {
        const cleanHeader = paragraph
          .replace(/^#+\s*/, '')
          .replace(/^\*\*/, '')
          .replace(/\*\*$/, '')
          .replace(/:$/, '')
          .trim();

        return (
          <div 
            key={pIdx} 
            className={`my-4 sm:my-5 py-2 px-3 sm:px-4 rounded-xl border flex items-center justify-between shadow-xs select-none ${paperStyles.sectionBannerClass}`}
          >
            <div className="flex items-center gap-2 font-bold text-base sm:text-lg">
              <span className="text-amber-500 text-lg">۞</span>
              <span className="tracking-wide">{cleanHeader}</span>
            </div>
            <span className="text-xs opacity-60 font-amiri tracking-widest hidden sm:inline">❖ ❖ ❖</span>
          </div>
        );
      }

      // 2. Check if paragraph is a List of points (Bullets / Numbers)
      const lines = paragraph.split('\n');
      const isBulletList = lines.length > 1 && lines.every((l) => /^\s*([*\-•]|\d+[\.\)])\s+/.test(l.trim()));

      if (isBulletList) {
        return (
          <ul key={pIdx} className="space-y-2.5 my-3 sm:my-4 pr-1 sm:pr-2">
            {lines.map((line, lIdx) => {
              const cleanedLine = line.replace(/^\s*([*\-•]|\d+[\.\)])\s+/, '').trim();
              return (
                <li key={lIdx} className="flex items-start gap-2.5 leading-relaxed">
                  <span className={`shrink-0 mt-1.5 text-xs select-none ${paperStyles.bulletClass}`}>
                    ✦
                  </span>
                  <div className={`flex-1 ${paperStyles.normalProseClass}`}>
                    {renderInlineFormattedText(cleanedLine)}
                  </div>
                </li>
              );
            })}
          </ul>
        );
      }

      // 3. Check for Scholarly citation (قال القرطبي / قال ابن كثير / عن ابن عباس)
      const isScholarlyQuote = 
        paragraph.startsWith('قال القرطبي') || 
        paragraph.startsWith('قال ابن كثير') || 
        paragraph.startsWith('قال الطبري') || 
        paragraph.startsWith('قال مجاهد') ||
        paragraph.startsWith('روى ') ||
        paragraph.startsWith('عن ');

      if (isScholarlyQuote) {
        return (
          <div 
            key={pIdx}
            className={`my-3.5 p-3.5 sm:p-4 rounded-xl relative shadow-xs ${paperStyles.scholarlyClass}`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 mb-1.5 select-none">
              <Quote className="w-3.5 h-3.5 rotate-180" />
              <span>أثر ومنقول تفسيري معتمد:</span>
            </div>
            <div className="tafsir-prose">
              {renderInlineFormattedText(paragraph)}
            </div>
          </div>
        );
      }

      // 4. Standard Flowing Paragraph with Islamic Prose Justification
      return (
        <p key={pIdx} className={`tafsir-prose my-3 text-justify font-normal ${paperStyles.normalProseClass}`}>
          {renderInlineFormattedText(paragraph)}
        </p>
      );
    });
  };

  /**
   * Parses bold tags, Quranic Ayah quotes «...» / ﴿...﴾, and quotes into rich spans
   */
  const renderInlineFormattedText = (lineText: string) => {
    // Regex splits by:
    // 1) Quranic brackets: ﴿...﴾ or «...»
    // 2) Bold markers: **...**
    const parts = lineText.split(/(﴿[^﴾]+﴾|«[^»]+»|\*\*[^*]+\*\*)/g);

    return parts.map((part, idx) => {
      if ((part.startsWith('﴿') && part.endsWith('﴾')) || (part.startsWith('«') && part.endsWith('»'))) {
        // Quranic Ayah Quote: Display in authentic Quranic Uthmani Script with high-contrast styling
        return (
          <span
            key={idx}
            className={`font-quran font-bold px-2 py-0.5 mx-1 rounded-md border shadow-xs inline-block tracking-wide align-baseline ${paperStyles.ayahQuoteClass}`}
            dir="rtl"
          >
            {part}
          </span>
        );
      } else if (part.startsWith('**') && part.endsWith('**')) {
        // Bold Emphasis with maximum clarity
        const cleanBold = part.slice(2, -2);
        return (
          <strong key={idx} className={`font-bold mx-0.5 ${paperStyles.boldClass}`}>
            {cleanBold}
          </strong>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Islamic Typography & Layout Customization Bar */}
      <div className="p-2 sm:p-2.5 bg-stone-950/80 border border-stone-800 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs select-none">
        
        {/* Font Family Switcher */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 text-[11px] text-stone-400 font-bold ml-1">
            <Type className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden xs:inline">نوع الخط:</span>
          </div>

          <div className="flex items-center gap-1 bg-stone-900 p-0.5 rounded-xl border border-stone-800">
            <button
              onClick={() => handleSetFont('amiri')}
              className={`px-2.5 py-1 rounded-lg text-xs transition font-amiri font-bold ${
                fontFamily === 'amiri'
                  ? 'bg-amber-600 text-stone-950 shadow-sm'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
              title="خط النسخ الأميري الكلاسيكي"
            >
              النسخ الأميري
            </button>

            <button
              onClick={() => handleSetFont('scheherazade')}
              className={`px-2.5 py-1 rounded-lg text-xs transition font-scheherazade font-bold ${
                fontFamily === 'scheherazade'
                  ? 'bg-amber-600 text-stone-950 shadow-sm'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
              title="خط شهرزاد الإسلامي التراثي"
            >
              شهرزاد
            </button>

            <button
              onClick={() => handleSetFont('naskh')}
              className={`px-2.5 py-1 rounded-lg text-xs transition font-naskh font-bold ${
                fontFamily === 'naskh'
                  ? 'bg-amber-600 text-stone-950 shadow-sm'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
              title="خط النسخ المعتمد"
            >
              النسخ
            </button>

            <button
              onClick={() => handleSetFont('ruqaa')}
              className={`px-2.5 py-1 rounded-lg text-xs transition font-ruqaa font-bold ${
                fontFamily === 'ruqaa'
                  ? 'bg-amber-600 text-stone-950 shadow-sm'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
              title="خط الرقعة الفني"
            >
              الرقعة
            </button>
          </div>
        </div>

        {/* Font Size & Paper Appearance */}
        <div className="flex items-center gap-2">
          {/* Paper Theme */}
          <div className="flex items-center gap-1 bg-stone-900 p-0.5 rounded-xl border border-stone-800">
            <button
              onClick={() => handleSetPaperTheme('manuscript')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                paperTheme === 'manuscript'
                  ? 'bg-[#edd9af] text-[#603813] shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="ورق مخطوطة عاجي دافئ"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#edd9af] border border-[#b48325]/60"></span>
              <span className="hidden sm:inline">عاجي</span>
            </button>

            <button
              onClick={() => handleSetPaperTheme('mushaf')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                paperTheme === 'mushaf'
                  ? 'bg-[#fffdf7] text-[#1c1917] shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="ورق مصحف كلاسيكي"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#fffdf7] border border-stone-300"></span>
              <span className="hidden sm:inline">مصحف</span>
            </button>

            <button
              onClick={() => handleSetPaperTheme('dark')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                paperTheme === 'dark'
                  ? 'bg-stone-800 text-amber-300 shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="وضع ليلي مذهب"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#18181b] border border-amber-500/50"></span>
              <span className="hidden sm:inline">ليلي</span>
            </button>
          </div>

          {/* Font Size Adjusters */}
          <div className="flex items-center bg-stone-900 rounded-xl border border-stone-800 p-0.5">
            <button
              onClick={() => handleSetFontSize(-1)}
              disabled={fontSizeLevel <= 0}
              className="p-1 text-stone-300 hover:text-white disabled:opacity-30 rounded transition"
              title="تصغير الخط (A-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[11px] font-mono text-stone-400 font-bold">
              {fontSizeLevel === 0 ? 'صغير' : fontSizeLevel === 1 ? 'وسط' : fontSizeLevel === 2 ? 'كبير' : 'أكبر'}
            </span>
            <button
              onClick={() => handleSetFontSize(1)}
              disabled={fontSizeLevel >= 3}
              className="p-1 text-stone-300 hover:text-white disabled:opacity-30 rounded transition"
              title="تكبير الخط (A+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Decorated Islamic Tafsir Paper Canvas */}
      <div 
        className={`p-5 sm:p-8 rounded-2xl border-2 shadow-2xl transition-all duration-300 relative ${paperStyles.containerClass} ${getFontFamilyClass()}`}
        dir="rtl"
      >
        {/* Subtle Corner Arabesque Watermarks */}
        <div className="absolute top-2 right-2 text-xs opacity-25 select-none pointer-events-none">❖</div>
        <div className="absolute top-2 left-2 text-xs opacity-25 select-none pointer-events-none">❖</div>
        <div className="absolute bottom-2 right-2 text-xs opacity-25 select-none pointer-events-none">❖</div>
        <div className="absolute bottom-2 left-2 text-xs opacity-25 select-none pointer-events-none">❖</div>

        {/* Header Bar inside Paper */}
        <div className={`pb-3 mb-4 border-b flex items-center justify-between text-xs select-none ${paperStyles.headerClass}`}>

          {/* Quick Actions (Copy, Refresh) */}
          <div className="mr-auto flex items-center gap-1.5">

            {onCopy && (
              <button
                onClick={onCopy}
                className="p-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-stone-900/10 hover:bg-stone-900/20 transition flex items-center gap-1"
                title="نسخ التفسير بالتشكيل"
              >
                {isCopied ? <Check className="w-4 h-4 text-emerald-600 font-bold" /> : <Copy className="w-4 h-4" />}
                <span className="text-[10px] hidden sm:inline font-bold">
                  {isCopied ? 'تم النسخ!' : 'نسخ'}
                </span>
              </button>
            )}

            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-stone-900/10 hover:bg-stone-900/20 transition"
                title="إعادة طلب التفسير"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Formatted Content Body */}
        <div className={`transition-all duration-200 select-text ${getFontSizeClasses()}`}>
          {renderFormattedTafsir(rawText)}
        </div>

        {/* Footer info: Source / Model */}
        <div className="mt-6 pt-3 border-t border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between text-[11px] opacity-75 font-amiri select-none">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>المصدر: {source || 'موسوعة التفسير المعتمدة (تفسير القرطبي والميسر)'}</span>
          </div>
          {processingTimeMs && (
            <span className="font-mono text-[10px]" dir="ltr">
              استجابة النموذج: {processingTimeMs}ms
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
