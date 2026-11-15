import { expect, test } from 'bun:test';
import { prayerScheduleInZone, zonedDay } from './prayer-zone';
const timings = { Fajr: '05:00', Sunrise: '06:15', Dhuhr: '12:00', Asr: '15:00', Maghrib: '18:00', Isha: '19:30' };
test('Amsterdam phone viewing Damascus counts to the selected location clock', () => {
  const now = new Date('2026-11-14T08:30:00Z');
  const schedule = prayerScheduleInZone(timings, now, 'Asia/Damascus', '2026-11-14');
  expect(schedule?.next?.key).toBe('Dhuhr'); expect(schedule?.next?.at.toISOString()).toBe('2026-11-14T09:00:00.000Z'); expect(schedule?.next?.remainingMs).toBe(1800000);
});
test('selected-location midnight and stale API date do not borrow the device day', () => {
  const now = new Date('2026-11-14T22:15:00Z');
  expect(zonedDay(now, 'Asia/Damascus')).toBe('2026-11-15');
  expect(prayerScheduleInZone(timings, now, 'Asia/Damascus', '2026-11-14')).toBeNull();
  expect(prayerScheduleInZone(timings, now, 'Asia/Damascus', '2026-11-15')?.next?.at.toISOString()).toBe('2026-11-15T02:00:00.000Z');
  expect(prayerScheduleInZone(timings, now, null, '2026-11-15')).toBeNull();
});
test('target-zone daylight saving and next-day rollover use actual instants', () => {
  const spring = prayerScheduleInZone(timings, new Date('2026-03-29T00:30:00Z'), 'Europe/Amsterdam', '2026-03-29');
  expect(spring?.next?.at.toISOString()).toBe('2026-03-29T03:00:00.000Z'); expect(spring?.next?.remainingMs).toBe(9000000);
  const autumn = prayerScheduleInZone(timings, new Date('2026-10-24T21:00:00Z'), 'Europe/Amsterdam', '2026-10-24');
  expect(autumn?.next?.isTomorrow).toBe(true); expect(autumn?.next?.at.toISOString()).toBe('2026-10-25T04:00:00.000Z');
});
