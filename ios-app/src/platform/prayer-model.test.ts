import { expect, test } from 'bun:test';
import { decodePrayerTimes } from './prayer-model';

const value = { governorate: 'damascus', latitude: 33.51, longitude: 36.27, method: 3,
  timings: { Fajr: '05:00', Sunrise: '06:15', Dhuhr: '12:00', Asr: '15:00', Maghrib: '18:00', Isha: '19:30' }, hijri: { day: '4', month: 'رجب', year: '1448' } };
test('decodes full prayer metadata and rejects malformed times instead of displaying an invented schedule', () => {
  expect(decodePrayerTimes(value)).toEqual(value);
  expect(() => decodePrayerTimes({ ...value, timings: { ...value.timings, Fajr: '25:75' } })).toThrow();
  expect(() => decodePrayerTimes({ ...value, timings: {} })).toThrow();
  expect(decodePrayerTimes({ ...value, hijri: null }).hijri).toBeNull();
});
