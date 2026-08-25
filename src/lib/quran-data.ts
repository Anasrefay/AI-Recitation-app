import { SURAHS, Surah } from '../data/surahs';
import { JUZ_LIST, JuzInfo } from '../data/juz';
import { getPageMetadata, PageMetadata } from '../data/pages-metadata';

export interface QuranDataSource {
  getPageImageUrl: (pageNumber: number) => string[];
  getPageMetadata: (pageNumber: number) => PageMetadata;
  getSurahs: () => Surah[];
  getSurahById: (id: number) => Surah | undefined;
  getSurahByPage: (page: number) => Surah | undefined;
  getJuzList: () => JuzInfo[];
  getJuzById: (id: number) => JuzInfo | undefined;
  searchSurahs: (query: string) => Surah[];
}

/**
 * Format page number with leading zeros (e.g., 1 -> "001", 45 -> "045")
 */
export function formatPageNumber(page: number): string {
  return String(page).padStart(3, '0');
}

/**
 * Removes Arabic diacritics (tashkeel), hamzas, and normalizes Arabic characters for flexible searching.
 */
export function normalizeArabicText(text: string): string {
  return text
    // Remove diacritics (fatha, damma, kasra, sukun, shadda, tanween)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize alifs: أ إ آ -> ا
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize taa marbouta: ة -> ه
    .replace(/ة/g, 'ه')
    // Normalize yaa: ى -> ي
    .replace(/ى/g, 'ي')
    // Remove tatweel
    .replace(/ـ/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Reliable CDN endpoints for King Fahd Complex Madinah Mushaf (Hafs) pages.
 * Multiple mirror tiers ensure 100% availability with fallback.
 */
export function getPageImageUrls(pageNumber: number): string[] {
  const clamped = Math.max(1, Math.min(604, pageNumber));
  const padded = formatPageNumber(clamped);

  return [
    // Primary: High-Resolution Madinah Mushaf from jsDelivr Global Edge CDN (150 DPI - fast & sharp)
    `https://cdn.jsdelivr.net/gh/sufone/medina-mushaf@master/png-d150/${clamped}.png`,
    // Secondary: Ultra High-Resolution (300 DPI)
    `https://cdn.jsdelivr.net/gh/sufone/medina-mushaf@master/png-d300/${clamped}.png`,
    // Direct GitHub Raw Fallbacks
    `https://raw.githubusercontent.com/sufone/medina-mushaf/master/png-d150/${clamped}.png`,
    `https://raw.githubusercontent.com/sufone/medina-mushaf/master/png-d300/${clamped}.png`,
    // Vector SVG Fallback
    `https://raw.githubusercontent.com/mushafdatabase/MushafDatabase-Ligature-Based-SVG/master/${clamped}.svg`
  ];
}

export const quranData: QuranDataSource = {
  getPageImageUrl: getPageImageUrls,
  getPageMetadata,
  getSurahs: () => SURAHS,
  getSurahById: (id: number) => SURAHS.find(s => s.id === id),
  getSurahByPage: (page: number) => {
    for (let i = SURAHS.length - 1; i >= 0; i--) {
      if (SURAHS[i].startPage <= page) {
        return SURAHS[i];
      }
    }
    return SURAHS[0];
  },
  getJuzList: () => JUZ_LIST,
  getJuzById: (id: number) => JUZ_LIST.find(j => j.id === id),
  searchSurahs: (query: string) => {
    if (!query.trim()) return SURAHS;
    const normalizedQuery = normalizeArabicText(query);
    return SURAHS.filter(s => {
      const normalizedName = normalizeArabicText(s.name);
      const normalizedTranslit = s.transliteration.toLowerCase();
      const idMatch = String(s.id) === query.trim();
      const pageMatch = String(s.startPage) === query.trim();
      return (
        normalizedName.includes(normalizedQuery) ||
        normalizedTranslit.includes(normalizedQuery) ||
        idMatch ||
        pageMatch
      );
    });
  }
};
