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

/**
 * Which digits a date prints in: Western (`latn`, the default) or
 * Arabic-Indic (`arab`).
 */
export type DateDigits = 'arab' | 'latn';

function digitsOf(n: number | string, digits: DateDigits): string {
  return digits === 'latn' ? String(n) : toArabicDigits(n);
}

/** e.g. "الخميس، 10 أيلول 2026". */
export function formatGregorianSyrian(date: Date | null, digits: DateDigits = 'latn'): string {
  if (!date) return '';
  return `${SYRIAN_WEEKDAYS_AR[date.getDay()]}، ${digitsOf(date.getDate(), digits)} ${SYRIAN_MONTHS_AR[date.getMonth()]} ${digitsOf(date.getFullYear(), digits)}`;
}

/** The wall-clock fields a date is printed from. */
interface DateParts {
  year: number;
  month: number; // 0-based
  day: number;
  hour: number;
  minute: number;
}

function localParts(date: Date): DateParts {
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

let damascusFormat: Intl.DateTimeFormat | null = null;

/**
 * An instant's wall-clock fields in Syria. Server timestamps are instants, and
 * printing them in the host's time zone would show a visitor abroad (and the
 * SSR process, whose zone differs from the browser's) another day or hour.
 */
function damascusParts(date: Date): DateParts {
  damascusFormat ??= new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Damascus',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });
  const field = (type: Intl.DateTimeFormatPartTypes) =>
    Number(damascusFormat!.formatToParts(date).find((part) => part.type === type)?.value);
  return {
    year: field('year'),
    month: field('month') - 1,
    day: field('day'),
    hour: field('hour') % 24,
    minute: field('minute'),
  };
}

/** A string that names an exact instant: it carries `Z` or a UTC offset. */
function isZonedTimestamp(value: string): boolean {
  return /T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(value);
}

/**
 * A `YYYY-MM-DD` string is a calendar date, not an instant: parsed by hand so no
 * time zone can move it to the neighbouring day, which `new Date('…')` (UTC
 * midnight) does west of Greenwich. A timestamp with a zone (or a number) is an
 * instant and reads in Syrian time; a Date or a zoneless timestamp is taken as
 * the wall-clock time it already holds.
 */
function parseParts(value: Date | string | number): DateParts | null {
  if (typeof value === 'string') {
    const calendar = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (calendar) {
      return { year: Number(calendar[1]), month: Number(calendar[2]) - 1, day: Number(calendar[3]), hour: 0, minute: 0 };
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const instant = typeof value === 'number' || (typeof value === 'string' && isZonedTimestamp(value));
  return instant ? damascusParts(date) : localParts(date);
}

/** e.g. "10 أيلول 2026" (no weekday, for compact event rows). */
export function formatGregorianSyrianShort(value: Date | string, digits: DateDigits = 'latn'): string {
  const parts = parseParts(value);
  if (!parts) return typeof value === 'string' ? value : '';
  return `${digitsOf(parts.day, digits)} ${SYRIAN_MONTHS_AR[parts.month]} ${digitsOf(parts.year, digits)}`;
}

/** e.g. "10 أيلول 2026، 14:30" — a timestamp, 24-hour, no weekday. */
export function formatSyrianDateTime(value: string | number | Date, digits: DateDigits = 'latn'): string {
  const parts = parseParts(value);
  if (!parts) return '';
  const time = `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
  return `${digitsOf(parts.day, digits)} ${SYRIAN_MONTHS_AR[parts.month]} ${digitsOf(parts.year, digits)}، ${digitsOf(time, digits)}`;
}
