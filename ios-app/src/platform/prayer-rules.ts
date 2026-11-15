import raw from '../../../resources/data/prayer.json';

export const prayerKeys = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export type PrayerKey = typeof prayerKeys[number];
export const prayerLabels: Record<PrayerKey, string> = { Fajr: 'الفجر', Sunrise: 'الشروق', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' };
export const methods = raw.methods.map(row => ({ id: row.id, nameAr: row.name_ar, detail: row.detail }));
export const defaultMethod = raw.default_method;
export const acceptedMethods = new Set([...methods.map(method => method.id), ...raw.unlisted_method_ids]);
export interface PrayerMoment { key: PrayerKey; label: string; time: string; at: Date; isPrayer: boolean }
export interface NextPrayer extends PrayerMoment { isTomorrow: boolean; remainingMs: number }
export interface PrayerSchedule { active: PrayerMoment | null; next: NextPrayer | null; remainingMs: number | null }
// Unchanged source calculation, without importing browser hooks or weakening native strict types.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const source = require('../../../resources/js/Domain/prayer/nextPrayer') as {
  prayerSchedule(timings: Record<string, string> | null | undefined, now: Date, options?: { includeSunrise?: boolean; rollover?: boolean }): PrayerSchedule | null;
};
export const prayerSchedule = source.prayerSchedule;

// PORT STATUS: source resources/js/Domain/prayer/nextPrayer.ts; confidence high; todos 0.
