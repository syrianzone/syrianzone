// Syrian-style Gregorian calendar (Levantine month names), rendered
// explicitly instead of relying on Intl ar-SY data so the output is
// identical in every browser/ICU build.
export const SYRIAN_MONTHS_AR = [
  'كانون الثاني',
  'شباط',
  'آذار',
  'نيسان',
  'أيار',
  'حزيران',
  'تموز',
  'آب',
  'أيلول',
  'تشرين الأول',
  'تشرين الثاني',
  'كانون الأول',
];

const SYRIAN_WEEKDAYS_AR = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function toArabicDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);
}

/** e.g. "الخميس، ١٠ أيلول ٢٠٢٦" */
export function formatGregorianSyrian(date: Date | null): string {
  if (!date) return '';
  return `${SYRIAN_WEEKDAYS_AR[date.getDay()]}، ${toArabicDigits(date.getDate())} ${SYRIAN_MONTHS_AR[date.getMonth()]} ${toArabicDigits(date.getFullYear())}`;
}

/**
 * A `YYYY-MM-DD` string is a calendar date, not an instant: parsed by hand so no
 * time zone can move it to the neighbouring day, which `new Date('…')` (UTC
 * midnight) does west of Greenwich.
 */
function parseCalendarDate(value: Date | string): Date | null {
  const calendar = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  const date = calendar
    ? new Date(Number(calendar[1]), Number(calendar[2]) - 1, Number(calendar[3]))
    : value instanceof Date
      ? value
      : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** e.g. "١٠ أيلول ٢٠٢٦" (no weekday, for compact event rows). */
export function formatGregorianSyrianShort(value: Date | string): string {
  const date = parseCalendarDate(value);
  if (!date) return typeof value === 'string' ? value : '';
  return `${toArabicDigits(date.getDate())} ${SYRIAN_MONTHS_AR[date.getMonth()]} ${toArabicDigits(date.getFullYear())}`;
}

/** e.g. "١٠ أيلول ٢٠٢٦، ١٤:٣٠" — a timestamp, 24-hour, no weekday. */
export function formatSyrianDateTime(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${toArabicDigits(date.getDate())} ${SYRIAN_MONTHS_AR[date.getMonth()]} ${toArabicDigits(date.getFullYear())}، ${toArabicDigits(time)}`;
}
