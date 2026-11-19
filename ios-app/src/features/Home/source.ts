// eslint-disable-next-line @typescript-eslint/no-require-imports
const quran = require('../../../../resources/js/Domain/quran/quran') as { SURAH_NAMES_AR: string[]; SURAH_AYAH_COUNTS: number[] };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dates = require('../../../../resources/js/Lib/syrian-date') as { formatGregorianSyrian(date: Date): string; formatGregorianSyrianShort(value: string): string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const hijri = require('../../../../resources/js/Domain/prayer/hijri') as { formatHijriDate(date: Date): string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const prayers = require('../../../../resources/js/Domain/prayer/nextPrayer') as { nextPrayer(timings: Record<string, string> | null, now: Date): { label: string; time: string } | null };
export const surahs = quran.SURAH_NAMES_AR.slice(1).map((name, index) => ({ number: index + 1, name: `سورة ${name}`, ayahs: quran.SURAH_AYAH_COUNTS[index + 1] ?? 0 }));
export const { formatGregorianSyrian, formatGregorianSyrianShort } = dates;
export const { formatHijriDate } = hijri;
export const { nextPrayer } = prayers;
// PORT STATUS: source resources/js/Lib/syrian-date.ts and resources/js/Domain/prayer/nextPrayer.ts; confidence high; todos 0.
