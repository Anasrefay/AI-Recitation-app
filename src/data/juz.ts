export interface JuzInfo {
  id: number;
  name: string;
  arabicName: string;
  startPage: number;
  endPage: number;
  startSurahName: string;
  startAyahText: string;
}

export const JUZ_LIST: JuzInfo[] = [
  { id: 1, name: "الجزء الأول", arabicName: "الم", startPage: 1, endPage: 21, startSurahName: "الفاتحة", startAyahText: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" },
  { id: 2, name: "الجزء الثاني", arabicName: "سَيَقُولُ", startPage: 22, endPage: 41, startSurahName: "البقرة", startAyahText: "سَيَقُولُ السُّفَهَاءُ مِنَ النَّاسِ" },
  { id: 3, name: "الجزء الثالث", arabicName: "تِلْكَ الرُّسُلُ", startPage: 42, endPage: 61, startSurahName: "البقرة", startAyahText: "تِلْكَ الرُّسُلُ فَضَّلْنَا بَعْضَهُمْ عَلَىٰ بَعْضٍ" },
  { id: 4, name: "الجزء الرابع", arabicName: "لَنْ تَنَالُوا", startPage: 62, endPage: 81, startSurahName: "آل عمران", startAyahText: "لَنْ تَنَالُوا الْبِرَّ حَتَّىٰ تُنْفِقُوا مِمَّا تُحِبُّونَ" },
  { id: 5, name: "الجزء الخامس", arabicName: "وَالْمُحْصَنَاتُ", startPage: 82, endPage: 101, startSurahName: "النساء", startAyahText: "وَالْمُحْصَنَاتُ مِنَ النِّسَاءِ إِلَّا مَا مَلَكَتْ أَيْمَانُكُمْ" },
  { id: 6, name: "الجزء السادس", arabicName: "لَا يُحِبُّ اللَّهُ", startPage: 102, endPage: 121, startSurahName: "النساء", startAyahText: "لَا يُحِبُّ اللَّهُ الْجَهْرَ بِالسُّوءِ مِنَ الْقَوْلِ" },
  { id: 7, name: "الجزء السابع", arabicName: "وَإِذَا سَمِعُوا", startPage: 122, endPage: 141, startSurahName: "المائدة", startAyahText: "وَإِذَا سَمِعُوا مَا أُنْزِلَ إِلَى الرَّسُولِ" },
  { id: 8, name: "الجزء الثامن", arabicName: "وَلَوْ أَنَّنَا", startPage: 142, endPage: 161, startSurahName: "الأنعام", startAyahText: "وَلَوْ أَنَّنَا نَزَّلْنَا إِلَيْهِمُ الْمَلَائِكَةَ" },
  { id: 9, name: "الجزء التاسع", arabicName: "قَالَ الْمَلَأُ", startPage: 162, endPage: 181, startSurahName: "الأعراف", startAyahText: "قَالَ الْمَلَأُ الَّذِينَ اسْتَكْبَرُوا مِنْ قَوْمِهِ" },
  { id: 10, name: "الجزء العاشر", arabicName: "وَاعْلَمُوا", startPage: 182, endPage: 201, startSurahName: "الأنفال", startAyahText: "وَاعْلَمُوا أَنَّمَا غَنِمْتُمْ مِنْ شَيْءٍ" },
  { id: 11, name: "الجزء الحادي عشر", arabicName: "يَعْتَذِرُونَ", startPage: 202, endPage: 221, startSurahName: "التوبة", startAyahText: "يَعْتَذِرُونَ إِلَيْكُمْ إِذَا رَجَعْتُمْ إِلَيْهِمْ" },
  { id: 12, name: "الجزء الثاني عشر", arabicName: "وَمَا مِنْ دَابَّةٍ", startPage: 222, endPage: 241, startSurahName: "هود", startAyahText: "وَمَا مِنْ دَابَّةٍ فِي الْأَرْضِ إِلَّا عَلَى اللَّهِ رِزْقُهَا" },
  { id: 13, name: "الجزء الثالث عشر", arabicName: "وَمَا أُبَرِّئُ", startPage: 242, endPage: 261, startSurahName: "يوسف", startAyahText: "وَمَا أُبَرِّئُ نَفْسِي إِنَّ النَّفْسَ لَأَمَّارَةٌ بِالسُّوءِ" },
  { id: 14, name: "الجزء الرابع عشر", arabicName: "رُبَمَا", startPage: 262, endPage: 281, startSurahName: "الحجر", startAyahText: "رُبَمَا يَوَدُّ الَّذِينَ كَفَرُوا لَوْ كَانُوا مُسْلِمِينَ" },
  { id: 15, name: "الجزء الخامس عشر", arabicName: "سُبْحَانَ الَّذِي", startPage: 282, endPage: 301, startSurahName: "الإسراء", startAyahText: "سُبْحَانَ الَّذِي أَسْرَىٰ بِعَبْدِهِ لَيْلًا" },
  { id: 16, name: "الجزء السادس عشر", arabicName: "قَالَ أَلَمْ", startPage: 302, endPage: 321, startSurahName: "الكهف", startAyahText: "قَالَ أَلَمْ أَقُلْ لَكَ إِنَّكَ لَنْ تَسْتَطِيعَ مَعِيَ صَبْرًا" },
  { id: 17, name: "الجزء السابع عشر", arabicName: "اقْتَرَبَ لِلنَّاسِ", startPage: 322, endPage: 341, startSurahName: "الأنبياء", startAyahText: "اقْتَرَبَ لِلنَّاسِ حِسَابُهُمْ وَهُمْ فِي غَفْلَةٍ مُعْرِضُونَ" },
  { id: 18, name: "الجزء الثامن عشر", arabicName: "قَدْ أَفْلَحَ", startPage: 342, endPage: 361, startSurahName: "المؤمنون", startAyahText: "قَدْ أَفْلَحَ الْمُؤْمِنُونَ" },
  { id: 19, name: "الجزء التاسع عشر", arabicName: "وَقَالَ الَّذِينَ", startPage: 362, endPage: 381, startSurahName: "الفرقان", startAyahText: "وَقَالَ الَّذِينَ لَا يَرْجُونَ لِقَاءَنَا لَوْلَا أُنْزِلَ عَلَيْنَا الْمَلَائِكَةُ" },
  { id: 20, name: "الجزء العشرون", arabicName: "أَمَّنْ خَلَقَ", startPage: 382, endPage: 401, startSurahName: "النمل", startAyahText: "أَمَّنْ خَلَقَ السَّمَاوَاتِ وَالْأَرْضَ وَأَنْزَلَ لَكُمْ" },
  { id: 21, name: "الجزء الحادي والعشرون", arabicName: "اتْلُ مَا أُوحِيَ", startPage: 402, endPage: 421, startSurahName: "العنكبوت", startAyahText: "اتْلُ مَا أُوحِيَ إِلَيْكَ مِنَ الْكِتَابِ" },
  { id: 22, name: "الجزء الثاني والعشرون", arabicName: "وَمَنْ يَقْنُتْ", startPage: 422, endPage: 441, startSurahName: "الأحزاب", startAyahText: "وَمَنْ يَقْنُتْ مِنْكُنَّ لِلَّهِ وَرَسُولِهِ" },
  { id: 23, name: "الجزء الثالث والعشرون", arabicName: "وَمَا أَنْزَلْنَا", startPage: 442, endPage: 461, startSurahName: "يس", startAyahText: "وَمَا أَنْزَلْنَا عَلَىٰ قَوْمِهِ مِنْ بَعْدِهِ مِنْ جُنْدٍ" },
  { id: 24, name: "الجزء الرابع والعشرون", arabicName: "فَمَنْ أَظْلَمُ", startPage: 462, endPage: 481, startSurahName: "الزمر", startAyahText: "فَمَنْ أَظْلَمُ مِمَّنْ كَذَبَ عَلَى اللَّهِ" },
  { id: 25, name: "الجزء الخامس والعشرون", arabicName: "إِلَيْهِ يُرَدُّ", startPage: 482, endPage: 501, startSurahName: "فصلت", startAyahText: "إِلَيْهِ يُرَدُّ عِلْمُ السَّاعَةِ" },
  { id: 26, name: "الجزء السادس والعشرون", arabicName: "حم", startPage: 502, endPage: 521, startSurahName: "الأحقاف", startAyahText: "حم . تَنْزِيلُ الْكِتَابِ مِنَ اللَّهِ الْعَزِيزِ الْحَكِيمِ" },
  { id: 27, name: "الجزء السابع والعشرون", arabicName: "قَالَ فَمَا خَطْبُكُمْ", startPage: 522, endPage: 541, startSurahName: "الذاريات", startAyahText: "قَالَ فَمَا خَطْبُكُمْ أَيُّهَا الْمُرْسَلُونَ" },
  { id: 28, name: "الجزء الثامن والعشرون", arabicName: "قَدْ سَمِعَ اللَّهُ", startPage: 542, endPage: 561, startSurahName: "المجادلة", startAyahText: "قَدْ سَمِعَ اللَّهُ قَوْلَ الَّتِي تُجَادِلُكَ فِي زَوْجِهَا" },
  { id: 29, name: "الجزء التاسع والعشرون", arabicName: "تَبَارَكَ الَّذِي", startPage: 562, endPage: 581, startSurahName: "الملك", startAyahText: "تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ" },
  { id: 30, name: "الجزء الثلاثون", arabicName: "عَمَّ", startPage: 582, endPage: 604, startSurahName: "النبأ", startAyahText: "عَمَّ يَتَسَاءَلُونَ . عَنِ النَّبَإِ الْعَظِيمِ" }
];
