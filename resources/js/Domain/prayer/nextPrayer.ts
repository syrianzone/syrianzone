import { PRAYER_KEYS, PRAYER_LABELS, type PrayerKey } from './methods';

/**
 * "Next prayer" / "active prayer" for one day of timings.
 *
 * The five surfaces that used to compute this each had their own answer for the
 * two edges of the day:
 *  - after Isha: Roznama and PrayerView rolled over to tomorrow's Fajr, the
 *    /muslim hub and the Board widget returned nothing, and Home named Fajr
 *    while printing today's clock time;
 *  - Sunrise: Home, Roznama, PrayerView and the Board widget count it as the
 *    next event, while the /muslim hub skipped it and went straight to Dhuhr.
 * Both edges are options of this module, not second implementations:
 * `includeSunrise: false` for a widget that only lists the five prayers, and
 * `rollover: false` for a tile whose empty state means "today's prayers are
 * over". Everything else is the union of the old behaviour.
 */

export interface PrayerMoment {
  key: PrayerKey;
  label: string;
  /** `HH:MM` as the endpoint returned it. */
  time: string;
  /** The moment on the clock; for a rolled-over prayer this is tomorrow. */
  at: Date;
  /** False for Sunrise, which is an event but not a prayer. */
  isPrayer: boolean;
}

export interface NextPrayerInfo extends PrayerMoment {
  /** True when the next moment is tomorrow's (after the last event of the day). */
  isTomorrow: boolean;
  /** Milliseconds until `at`; never negative. */
  remainingMs: number;
}

export interface PrayerSchedule {
  /** The event that started most recently, possibly yesterday's last one. */
  active: PrayerMoment | null;
  /** Null only when `rollover` is off and the day's events are over. */
  next: NextPrayerInfo | null;
  remainingMs: number | null;
}

export interface PrayerScheduleOptions {
  /** Default true: Sunrise is an event on the timeline. */
  includeSunrise?: boolean;
  /** Default true: after Isha the next prayer is tomorrow's Fajr. */
  rollover?: boolean;
}

type Timings = Record<string, string> | null | undefined;

function parseAt(time: string, now: Date): Date | null {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const at = new Date(now);
  at.setHours(hours, minutes, 0, 0);
  return at;
}

function placeAtDay(at: Date, days: number): Date {
  const placed = new Date(at);
  placed.setDate(placed.getDate() + days);
  return placed;
}

/** Today's events in clock order, skipping the ones the timings do not carry. */
function timeline(timings: Timings, now: Date, includeSunrise: boolean): PrayerMoment[] {
  if (!timings) return [];
  const moments: PrayerMoment[] = [];
  for (const key of PRAYER_KEYS) {
    if (!includeSunrise && key === 'Sunrise') continue;
    const raw = timings[key];
    if (!raw) continue;
    const at = parseAt(raw, now);
    if (!at) continue;
    moments.push({
      key,
      label: PRAYER_LABELS[key],
      time: raw.slice(0, 5),
      at,
      isPrayer: key !== 'Sunrise',
    });
  }
  return moments.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * Active and next prayer for `now`. A prayer that starts exactly at `now` is
 * already active, so the countdown always targets a time in the future.
 */
export function prayerSchedule(
  timings: Timings,
  now: Date,
  options: PrayerScheduleOptions = {},
): PrayerSchedule | null {
  const { includeSunrise = true, rollover = true } = options;
  const moments = timeline(timings, now, includeSunrise);
  if (moments.length === 0) return null;

  const last = moments[moments.length - 1];
  const nextIndex = moments.findIndex((moment) => moment.at.getTime() > now.getTime());

  if (nextIndex === -1) {
    if (!rollover) return { active: last, next: null, remainingMs: null };
    const tomorrow = placeAtDay(moments[0].at, 1);
    return {
      active: last,
      next: {
        ...moments[0],
        at: tomorrow,
        isTomorrow: true,
        remainingMs: Math.max(0, tomorrow.getTime() - now.getTime()),
      },
      remainingMs: Math.max(0, tomorrow.getTime() - now.getTime()),
    };
  }

  const next = moments[nextIndex];
  const active =
    nextIndex === 0
      ? { ...last, at: placeAtDay(last.at, -1) }
      : moments[nextIndex - 1];
  const remainingMs = Math.max(0, next.at.getTime() - now.getTime());
  return {
    active,
    next: { ...next, isTomorrow: false, remainingMs },
    remainingMs,
  };
}

export function nextPrayer(
  timings: Timings,
  now: Date,
  options?: PrayerScheduleOptions,
): NextPrayerInfo | null {
  return prayerSchedule(timings, now, options)?.next ?? null;
}

export function activePrayer(
  timings: Timings,
  now: Date,
  options?: PrayerScheduleOptions,
): PrayerMoment | null {
  return prayerSchedule(timings, now, options)?.active ?? null;
}
