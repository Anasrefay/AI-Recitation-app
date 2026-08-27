import { SURAHS } from './surahs';
import { JUZ_LIST } from './juz';

export interface PageMetadata {
  pageNumber: number;
  juzNumber: number;
  hizbNumber: number;
  rubNumber: number;
  surahName: string;
  surahId: number;
  surahsOnPage: Array<{ id: number; name: string }>;
  isSurahStart: boolean;
}

export function getPageMetadata(pageNumber: number): PageMetadata {
  const clampedPage = Math.max(1, Math.min(604, pageNumber));

  // Find Juz
  let currentJuz = 1;
  for (const juz of JUZ_LIST) {
    if (clampedPage >= juz.startPage && clampedPage <= juz.endPage) {
      currentJuz = juz.id;
      break;
    }
  }

  // Find Surah(s) that exist on this page
  const surahsOnThisPage = SURAHS.filter((surah, index) => {
    const nextSurah = SURAHS[index + 1];
    const surahEndPage = nextSurah ? nextSurah.startPage : 604;
    // Check if surah starts on or before this page, and next surah starts after or on this page
    return surah.startPage <= clampedPage && (nextSurah ? nextSurah.startPage >= clampedPage : true);
  });

  // Find primary surah (the one that began most recently before or on this page)
  let primarySurah = SURAHS[0];
  for (let i = SURAHS.length - 1; i >= 0; i--) {
    if (SURAHS[i].startPage <= clampedPage) {
      primarySurah = SURAHS[i];
      break;
    }
  }

  const isSurahStart = SURAHS.some(s => s.startPage === clampedPage);
  
  // Calculate approximate Hizb and Rub (quarter) based on Madinah Mushaf (each Juz is 2 Hizbs, 8 Rubs, ~20 pages per Juz)
  const juzStartPage = JUZ_LIST[currentJuz - 1]?.startPage || 1;
  const pageInJuz = clampedPage - juzStartPage;
  const hizbOffset = pageInJuz >= 10 ? 1 : 0;
  const hizbNumber = (currentJuz - 1) * 2 + 1 + hizbOffset;
  const rubInJuz = Math.min(8, Math.floor(pageInJuz / 2.5) + 1);
  const rubNumber = (currentJuz - 1) * 8 + rubInJuz;

  return {
    pageNumber: clampedPage,
    juzNumber: currentJuz,
    hizbNumber,
    rubNumber,
    surahName: primarySurah.name,
    surahId: primarySurah.id,
    surahsOnPage: surahsOnThisPage.map(s => ({ id: s.id, name: s.name })),
    isSurahStart
  };
}
