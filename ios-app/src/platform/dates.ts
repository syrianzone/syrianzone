export { formatDuration } from '../../../resources/js/Lib/format';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dates = require('../../../resources/js/Lib/syrian-date') as {
  formatGregorianSyrian(date: Date | null): string;
  formatGregorianSyrianShort(value: Date | string): string;
  formatSyrianDateTime(value: Date | string | number): string;
  toArabicDigits(value: string | number): string;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const hijri = require('../../../resources/js/Domain/prayer/hijri') as {
  formatHijriDate(date: Date): string;
  hijriDateLabel(value: { day: string; month: string; year: string } | null): string | null;
};
export const { formatGregorianSyrian, formatGregorianSyrianShort, formatSyrianDateTime, toArabicDigits } = dates;
export const { formatHijriDate, hijriDateLabel } = hijri;

// PORT STATUS: source resources/js/Lib/syrian-date.ts and resources/js/Domain/prayer/hijri.ts; confidence high; todos 0.
