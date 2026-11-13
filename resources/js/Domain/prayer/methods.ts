import raw from '../../../data/prayer.json';

/**
 * AlAdhan calculation methods.
 *
 * The table is `resources/data/prayer.json` (documented in
 * `resources/data/README.md`) and `App\Http\Controllers\PrayerController` reads
 * the same file through `App\Support\Facts`: the picker offers `methods`, and
 * the server also accepts `unlisted_method_ids` so a method stored by another
 * client (7, 14, 15, 16) is kept rather than silently replaced.
 *
 * The choice is exposed to the user on purpose: per Itqan #720 the method is a
 * fiqh decision, never a silent coder default.
 */
export interface PrayerMethod {
  id: number;
  nameAr: string;
  nameEn: string;
  detail: string;
}

/** What the settings picker offers, in display order. */
export const PRAYER_METHODS: PrayerMethod[] = raw.methods.map((row) => ({
  id: row.id,
  nameAr: row.name_ar,
  nameEn: row.name_en,
  detail: row.detail,
}));

export const DEFAULT_PRAYER_METHOD: number = raw.default_method;

/** Every id the timings endpoint accepts: the offered list plus the unlisted ids. */
const ACCEPTED_METHOD_IDS: ReadonlySet<number> = new Set([
  ...PRAYER_METHODS.map((method) => method.id),
  ...raw.unlisted_method_ids,
]);

/** True for a method a stored preference may hold, offered or not. */
export function isAcceptedPrayerMethod(id: number): boolean {
  return ACCEPTED_METHOD_IDS.has(id);
}

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
