/**
 * The variable (lunar and Easter) holiday dates for a Gregorian year.
 *
 * The lunar ones come from the Umm al-Qura calendar in `Intl` and the Easters
 * from the computus, so the Roznama keeps working past the years the reviewed
 * table covers. The table stays authoritative where it has a year: the
 * announced dates follow the moon sighting, which a calendar cannot predict.
 */

export type VariableHolidayId =
  | 'eid-fitr'
  | 'eid-adha'
  | 'hijri-new-year'
  | 'mawlid'
  | 'western-easter'
  | 'eastern-easter';

export interface MonthDay {
  /** 1-12 */
  month: number;
  day: number;
}

/** Reviewed dates (announced, moon-sighted). Wins over the computed ones. */
export const VARIABLE_HOLIDAYS_MAP: Record<number, Record<VariableHolidayId, MonthDay>> = {
  2026: {
    'eid-fitr': { month: 3, day: 20 },
    'eid-adha': { month: 5, day: 27 },
    'hijri-new-year': { month: 6, day: 16 },
    'mawlid': { month: 8, day: 26 },
    'western-easter': { month: 4, day: 5 },
    'eastern-easter': { month: 4, day: 12 },
  },
  2027: {
    'eid-fitr': { month: 3, day: 10 },
    'eid-adha': { month: 5, day: 16 },
    'hijri-new-year': { month: 6, day: 6 },
    'mawlid': { month: 8, day: 15 },
    'western-easter': { month: 3, day: 28 },
    'eastern-easter': { month: 5, day: 2 },
  },
};

/** Hijri month/day of each lunar holiday. */
const LUNAR: Record<Exclude<VariableHolidayId, 'western-easter' | 'eastern-easter'>, { month: number; day: number }> = {
  'eid-fitr': { month: 10, day: 1 }, // 1 Shawwal
  'eid-adha': { month: 12, day: 10 }, // 10 Dhu al-Hijjah
  'hijri-new-year': { month: 1, day: 1 }, // 1 Muharram
  'mawlid': { month: 3, day: 12 }, // 12 Rabi' al-Awwal
};

let umalqura: Intl.DateTimeFormat | null | undefined;

function umalquraFormat(): Intl.DateTimeFormat | null {
  if (umalqura !== undefined) return umalqura;
  try {
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    // An engine without the calendar silently formats Gregorian instead.
    umalqura = fmt.resolvedOptions().calendar.startsWith('islamic') ? fmt : null;
  } catch {
    umalqura = null;
  }
  return umalqura;
}

/**
 * Every date in `year` on which each lunar holiday falls (a Gregorian year can
 * hold the same Hijri date twice, as 1 Muharram did in 2008). Empty when the
 * runtime has no Islamic calendar.
 */
export function lunarHolidayDates(year: number): Partial<Record<keyof typeof LUNAR, MonthDay[]>> {
  const fmt = umalquraFormat();
  if (!fmt) return {};
  const found: Partial<Record<keyof typeof LUNAR, MonthDay[]>> = {};
  const ids = Object.keys(LUNAR) as (keyof typeof LUNAR)[];
  for (let t = Date.UTC(year, 0, 1, 12); new Date(t).getUTCFullYear() === year; t += 86_400_000) {
    let month = 0;
    let day = 0;
    for (const part of fmt.formatToParts(new Date(t))) {
      if (part.type === 'month') month = Number(part.value);
      else if (part.type === 'day') day = Number(part.value);
    }
    for (const id of ids) {
      if (LUNAR[id].month === month && LUNAR[id].day === day) {
        const at = new Date(t);
        (found[id] ??= []).push({ month: at.getUTCMonth() + 1, day: at.getUTCDate() });
      }
    }
  }
  return found;
}

/** Western (Gregorian) Easter Sunday: the anonymous Gregorian computus. */
export function westernEaster(year: number): MonthDay {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * Eastern (Orthodox) Easter Sunday on the Gregorian calendar: the Julian
 * computus plus the Julian-Gregorian offset (13 days for 1900-2099).
 */
export function easternEaster(year: number): MonthDay {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const julianMonth = Math.floor((d + e + 114) / 31);
  const julianDay = ((d + e + 114) % 31) + 1;
  const offset = Math.floor(year / 100) - Math.floor(year / 400) - 2;
  const at = new Date(Date.UTC(year, julianMonth - 1, julianDay + offset));
  return { month: at.getUTCMonth() + 1, day: at.getUTCDate() };
}

/**
 * The variable holidays of `year`, each with every date it falls on: the
 * reviewed table when it covers the year, otherwise the computed dates.
 */
export function variableHolidays(year: number): Partial<Record<VariableHolidayId, MonthDay[]>> {
  const reviewed = VARIABLE_HOLIDAYS_MAP[year];
  if (reviewed) {
    const out: Partial<Record<VariableHolidayId, MonthDay[]>> = {};
    for (const [id, date] of Object.entries(reviewed) as [VariableHolidayId, MonthDay][]) out[id] = [date];
    return out;
  }
  return {
    ...lunarHolidayDates(year),
    'western-easter': [westernEaster(year)],
    'eastern-easter': [easternEaster(year)],
  };
}
