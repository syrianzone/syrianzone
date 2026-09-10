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

export const SYRIAN_WEEKDAYS_AR = [
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

/** e.g. "١٠ أيلول ٢٠٢٦" (no weekday, for compact event rows). */
export function formatGregorianSyrianShort(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return `${toArabicDigits(date.getDate())} ${SYRIAN_MONTHS_AR[date.getMonth()]} ${toArabicDigits(date.getFullYear())}`;
  } catch {
    return dateStr;
  }
}
