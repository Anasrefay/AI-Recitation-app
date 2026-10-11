export interface Reciter {
  id: string;
  name: string;
  subfolder: string;
  style?: 'مرتل' | 'مجود' | 'معلم';
  bitrate?: string;
  country?: string;
}

export const RECITERS_LIST: Reciter[] = [
  {
    id: 'alafasy',
    name: 'الشيخ مشاري راشد العفاسي',
    subfolder: 'Alafasy_128kbps',
    style: null,
    bitrate: '128kbps',
    country: 'الكويت'
  },
  {
    id: 'husary_murattal',
    name: 'الشيخ محمود خليل الحصري',
    subfolder: 'Husary_128kbps',
    style: 'مرتل',
    bitrate: '128kbps',
    country: 'مصر'
  },
  {
    id: 'husary_mujawwad',
    name: 'الشيخ محمود خليل الحصري',
    subfolder: 'Husary_128kbps_Mujawwad',
    style: 'مجود',
    bitrate: '128kbps',
    country: 'مصر'
  },
  {
    id: 'husary_muallim',
    name: 'الشيخ محمود خليل الحصري',
    subfolder: 'Husary_Muallim_128kbps',
    style: 'معلم',
    bitrate: '128kbps',
    country: 'مصر'
  },
  {
    id: 'minshawy_murattal',
    name: 'الشيخ محمد صديق المنشاوي',
    subfolder: 'Minshawy_Murattal_128kbps',
    style: 'مرتل',
    bitrate: '128kbps',
    country: 'مصر'
  },
  {
    id: 'minshawy_mujawwad',
    name: 'الشيخ محمد صديق المنشاوي',
    subfolder: 'Minshawy_Mujawwad_192kbps',
    style: 'مجود',
    bitrate: '192kbps',
    country: 'مصر'
  },
  {
    id: 'abdulbasit_murattal',
    name: 'الشيخ عبد الباسط عبد الصمد',
    subfolder: 'Abdul_Basit_Murattal_192kbps',
    style: 'مرتل',
    bitrate: '192kbps',
    country: 'مصر'
  },
  {
    id: 'abdulbasit_mujawwad',
    name: 'الشيخ عبد الباسط عبد الصمد',
    subfolder: 'Abdul_Basit_Mujawwad_128kbps',
    style: 'مجود',
    bitrate: '128kbps',
    country: 'مصر'
  },
  {
    id: 'maher_almuaiqly',
    name: 'الشيخ ماهر المعيقلي',
    subfolder: 'MaherAlMuaiqly128kbps',
    style: null,
    bitrate: '128kbps',
    country: 'السعودية'
  },
  {
    id: 'sudais',
    name: 'الشيخ عبد الرحمن السديس',
    subfolder: 'Abdurrahmaan_As-Sudais_192kbps',
    style: null,
    bitrate: '192kbps',
    country: 'السعودية'
  },
  {
    id: 'shuraym',
    name: 'الشيخ سعود الشريم',
    subfolder: 'Saood_ash-Shuraym_128kbps',
    style: null,
    bitrate: '128kbps',
    country: 'السعودية'
  },
  {
    id: 'ghamadi',
    name: 'الشيخ سعد الغامدي',
    subfolder: 'Ghamadi_40kbps',
    style: null,
    bitrate: '40kbps',
    country: 'السعودية'
  },
  {
    id: 'yasser_dussary',
    name: 'الشيخ ياسر الدوسري',
    subfolder: 'Yasser_Ad-Dussary_128kbps',
    style: null,
    bitrate: '128kbps',
    country: 'السعودية'
  },
  {
    id: 'nasser_alqatami',
    name: 'الشيخ ناصر القطامي',
    subfolder: 'Nasser_Alqatami_128kbps',
    style: null,
    bitrate: '128kbps',
    country: 'السعودية'
  },
  {
    id: 'shaatree',
    name: 'الشيخ أبو بكر الشاطري',
    subfolder: 'Abu_Bakr_Ash-Shaatree_128kbps',
    style: null,
    bitrate: '128kbps',
    country: 'السعودية'
  },
  {
    id: 'ayyoub',
    name: 'الشيخ محمد أيوب',
    subfolder: 'Muhammad_Ayyoub_128kbps',
    style: null,
    bitrate: '128kbps',
    country: 'السعودية'
  },
  {
    id: 'ali_jaber',
    name: 'الشيخ علي عبد الله جابر',
    subfolder: 'Ali_Jaber_64kbps',
    style: null,
    bitrate: '64kbps',
    country: 'السعودية'
  },
  {
    id: 'ajamy',
    name: 'الشيخ أحمد بن علي العجمي',
    subfolder: 'Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net',
    style: null,
    bitrate: '128kbps',
    country: 'السعودية'
  },
  {
    id: 'ayman_sowaid',
    name: 'الشيخ أيمن رشدي سويد',
    subfolder: 'Ayman_Sowaid_64kbps',
    style: 'معلم',
    bitrate: '64kbps',
    country: 'سوريا'
  },
  {
    id: 'fares_abbad',
    name: 'الشيخ فارس عباد',
    subfolder: 'Fares_Abbad_64kbps',
    style: null,
    bitrate: '64kbps',
    country: 'اليمن'
  },
  {
    id: 'hani_rifai',
    name: 'الشيخ هاني الرفاعي',
    subfolder: 'Hani_Rifai_192kbps',
    style: null,
    bitrate: '192kbps',
    country: 'السعودية'
  },
  {
    id: 'hudhaify',
    name: 'الشيخ علي بن عبد الرحمن الحذيفي',
    subfolder: 'Hudhaify_128kbps',
    style: null,
    bitrate: '128kbps',
    country: 'السعودية'
  },
  {
    id: 'basfar',
    name: 'الشيخ عبد الله بصفر',
    subfolder: 'Abdullah_Basfar_192kbps',
    style: null,
    bitrate: '192kbps',
    country: 'السعودية'
  }
];

export const DEFAULT_RECITER_ID = 'alafasy';

export function getReciterById(id: string): Reciter {
  return RECITERS_LIST.find((r) => r.id === id) || RECITERS_LIST[0];
}

/**
 * Builds the EveryAyah direct MP3 audio URL
 * Format: https://everyayah.com/data/{subfolder}/{surah3}{ayah3}.mp3
 */
export function getAyahAudioUrl(
  subfolder: string,
  surahNumber: number,
  ayahNumberInSurah: number
): string {
  const surahStr = String(surahNumber).padStart(3, '0');
  const ayahStr = String(ayahNumberInSurah).padStart(3, '0');
  return `https://everyayah.com/data/${subfolder}/${surahStr}${ayahStr}.mp3`;
}
