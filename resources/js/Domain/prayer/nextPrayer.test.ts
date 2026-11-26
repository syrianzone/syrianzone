import { describe, expect, it } from 'vitest';
import { activePrayer, nextPrayer, prayerSchedule } from './nextPrayer';

// One day of timings in the shape PrayerController returns (`HH:MM`).
const TIMINGS = {
  Fajr: '05:00',
  Sunrise: '06:20',
  Dhuhr: '12:15',
  Asr: '15:35',
  Maghrib: '18:20',
  Isha: '19:45',
};

const at = (hours: number, minutes: number) => new Date(2026, 10, 12, hours, minutes, 0, 0);

describe('nextPrayer', () => {
  it('before Fajr: tomorrow-named prayer is today Fajr, active is yesterday Isha', () => {
    const now = at(4, 0);
    const schedule = prayerSchedule(TIMINGS, now);
    expect(schedule?.next?.key).toBe('Fajr');
    expect(schedule?.next?.isTomorrow).toBe(false);
    expect(schedule?.next?.remainingMs).toBe(60 * 60 * 1000);
    expect(schedule?.active?.key).toBe('Isha');
    expect(schedule?.active?.at.getDate()).toBe(now.getDate() - 1);
  });

  it('between prayers: next is the following event, active is the one just started', () => {
    const schedule = prayerSchedule(TIMINGS, at(13, 0));
    expect(schedule?.next?.key).toBe('Asr');
    expect(schedule?.next?.time).toBe('15:35');
    expect(schedule?.active?.key).toBe('Dhuhr');
  });

  it('after Isha: rolls over to tomorrow Fajr and counts down past midnight', () => {
    const now = at(20, 0);
    const next = nextPrayer(TIMINGS, now);
    expect(next?.key).toBe('Fajr');
    expect(next?.isTomorrow).toBe(true);
    expect(next?.remainingMs).toBe(9 * 60 * 60 * 1000);
    expect(activePrayer(TIMINGS, now)?.key).toBe('Isha');
  });

  it('after Isha without rollover: no next prayer, today Isha stays active', () => {
    const schedule = prayerSchedule(TIMINGS, at(20, 0), { rollover: false });
    expect(schedule?.next).toBeNull();
    expect(schedule?.active?.key).toBe('Isha');
  });

  it('exactly at a prayer time: that prayer is active, the countdown targets the following one', () => {
    const schedule = prayerSchedule(TIMINGS, at(12, 15));
    expect(schedule?.active?.key).toBe('Dhuhr');
    expect(schedule?.next?.key).toBe('Asr');
    expect(schedule?.remainingMs).toBe((3 * 60 + 20) * 60 * 1000);
  });

  it('exactly at Fajr: Fajr is active and Sunrise is next', () => {
    const schedule = prayerSchedule(TIMINGS, at(5, 0));
    expect(schedule?.active?.key).toBe('Fajr');
    expect(schedule?.next?.key).toBe('Sunrise');
  });

  it('Sunrise is an event but not a prayer', () => {
    const next = nextPrayer(TIMINGS, at(5, 30));
    expect(next?.key).toBe('Sunrise');
    expect(next?.label).toBe('الشروق');
    expect(next?.isPrayer).toBe(false);
  });

  it('a surface that lists only the five prayers skips Sunrise', () => {
    expect(nextPrayer(TIMINGS, at(5, 30), { includeSunrise: false })?.key).toBe('Dhuhr');
    expect(nextPrayer(TIMINGS, at(13, 0), { includeSunrise: false })?.key).toBe('Asr');
  });

  it('returns null when the timings carry nothing usable', () => {
    expect(nextPrayer(null, at(13, 0))).toBeNull();
    expect(nextPrayer({}, at(13, 0))).toBeNull();
    expect(nextPrayer({ Fajr: '--:--' }, at(13, 0))).toBeNull();
  });
});

describe('nextPrayer in the location time zone', () => {
  // 2026-11-12 10:00 UTC is 13:00 in Damascus (UTC+3) and 05:00 in New York.
  const now = new Date(Date.UTC(2026, 10, 12, 10, 0, 0));

  it('reads the timings on the location clock, not the device clock', () => {
    const schedule = prayerSchedule(TIMINGS, now, { timeZone: 'Asia/Damascus' });
    expect(schedule?.active?.key).toBe('Dhuhr');
    expect(schedule?.next?.key).toBe('Asr');
    // Asr 15:35 Damascus = 12:35 UTC: 2h35m away.
    expect(schedule?.remainingMs).toBe((2 * 60 + 35) * 60 * 1000);
  });

  it('rolls over to tomorrow on the location calendar', () => {
    const late = new Date(Date.UTC(2026, 10, 12, 18, 0, 0)); // 21:00 Damascus
    const next = nextPrayer(TIMINGS, late, { timeZone: 'Asia/Damascus' });
    expect(next?.key).toBe('Fajr');
    expect(next?.isTomorrow).toBe(true);
    expect(next?.at.toISOString()).toBe('2026-11-13T02:00:00.000Z');
  });

  it('keeps the wall-clock time across a DST change', () => {
    // New York leaves DST on 2026-11-01 at 02:00; Isha on 10-31 and Fajr on 11-01.
    const evening = new Date(Date.UTC(2026, 9, 31, 23, 50, 0)); // 19:50 EDT
    const next = nextPrayer(TIMINGS, evening, { timeZone: 'America/New_York' });
    expect(next?.key).toBe('Fajr');
    expect(next?.at.toISOString()).toBe('2026-11-01T10:00:00.000Z'); // 05:00 EST
  });
});
