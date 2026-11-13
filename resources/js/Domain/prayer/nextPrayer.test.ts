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
