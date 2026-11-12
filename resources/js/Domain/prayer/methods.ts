// AlAdhan calculation methods. IDs verified against GET /v1/methods.
// Method 3 (Muslim World League, Fajr 18° / Isha 17°) is the Syrian standard
// and the default. The choice is exposed to the user on purpose: per Itqan
// #720 the method is a fiqh decision, never a silent coder default.
export interface PrayerMethod {
  id: number;
  nameAr: string;
  nameEn: string;
  detail: string;
}

export const PRAYER_METHODS: PrayerMethod[] = [
  { id: 3, nameAr: 'رابطة العالم الإسلامي', nameEn: 'Muslim World League', detail: 'فجر 18° / عشاء 17° — المعتمد في سوريا' },
  { id: 5, nameAr: 'الهيئة المصرية للمساحة', nameEn: 'Egyptian General Authority', detail: 'فجر 19.5° / عشاء 17.5°' },
  { id: 4, nameAr: 'جامعة أم القرى (مكة)', nameEn: 'Umm al-Qura, Makkah', detail: 'فجر 18.5° / عشاء 90 دقيقة بعد المغرب' },
  { id: 1, nameAr: 'جامعة العلوم الإسلامية (كراتشي)', nameEn: 'Karachi', detail: 'فجر 18° / عشاء 18°' },
  { id: 2, nameAr: 'الجمعية الإسلامية لأمريكا الشمالية', nameEn: 'ISNA', detail: 'فجر 15° / عشاء 15°' },
  { id: 8, nameAr: 'الخليج', nameEn: 'Gulf Region', detail: 'فجر 19.5° / عشاء 90 دقيقة' },
  { id: 9, nameAr: 'الكويت', nameEn: 'Kuwait', detail: 'فجر 18° / عشاء 17.5°' },
  { id: 10, nameAr: 'قطر', nameEn: 'Qatar', detail: 'فجر 18° / عشاء 90 دقيقة' },
  { id: 11, nameAr: 'سنغافورة', nameEn: 'Singapore', detail: 'فجر 20° / عشاء 18°' },
  { id: 12, nameAr: 'فرنسا', nameEn: 'UOIF, France', detail: 'فجر 12° / عشاء 12°' },
  { id: 13, nameAr: 'تركيا (الديانة)', nameEn: 'Diyanet, Turkey', detail: 'فجر 18° / عشاء 17°' },
  { id: 0, nameAr: 'جعفري (شيعة)', nameEn: 'Shia Ithna-Ashari', detail: 'فجر 16° / عشاء 14°' },
];

export const DEFAULT_PRAYER_METHOD = 3;

export const PRAYER_KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export type PrayerKey = (typeof PRAYER_KEYS)[number];

export const PRAYER_LABELS: Record<PrayerKey, string> = {
  Fajr: 'الفجر',
  Sunrise: 'الشروق',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
};
