/**
 * Wall-clock ↔ instant conversion for an IANA time zone, with `Intl` only
 * (Temporal is not Baseline yet).
 *
 * Prayer timings are wall-clock times *at the location* ("Fajr 05:00 in
 * Damascus"). A visitor in Berlin who follows Damascus must see the countdown to
 * 05:00 Damascus time, not to 05:00 on their own clock, so the timeline places
 * every `HH:MM` in the location's zone.
 */

export interface WallDate {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timeZone, fmt);
  }
  return fmt;
}

/** True when the runtime knows this IANA zone (guards untrusted input). */
export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || timeZone === '' || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

interface WallParts extends WallDate {
  hour: number;
  minute: number;
  second: number;
}

function wallParts(instant: Date, timeZone: string): WallParts {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** The zone's UTC offset (ms) at `instant`. */
function offsetAt(instant: Date, timeZone: string): number {
  const p = wallParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The calendar date it is in `timeZone` at `instant`. */
export function wallDateIn(instant: Date, timeZone: string): WallDate {
  const { year, month, day } = wallParts(instant, timeZone);
  return { year, month, day };
}

/**
 * The instant at which the clock in `timeZone` reads `date` at `hours:minutes`.
 * `dayOffset` moves the wall date by calendar days (DST-safe). Two passes settle
 * the offset across a DST change.
 */
export function zonedInstant(
  date: WallDate,
  hours: number,
  minutes: number,
  timeZone: string,
  dayOffset = 0,
): Date {
  const wallUtc = Date.UTC(date.year, date.month - 1, date.day + dayOffset, hours, minutes, 0, 0);
  let guess = wallUtc - offsetAt(new Date(wallUtc), timeZone);
  guess = wallUtc - offsetAt(new Date(guess), timeZone);
  return new Date(guess);
}
