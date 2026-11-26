import { describe, expect, it } from 'vitest';
import type { LocationPreference } from '../location/preference';
import { SYRIA_TIMEZONE } from '../geography/syria';
import { parseCachedPrayerTimes, prayerTimeZone } from './times';
import { isValidTimeZone } from './zonedTime';

const governorate: LocationPreference = {
  city: 'aleppo',
  useCustomCoords: false,
  customLat: '',
  customLon: '',
  mode: 'city',
  geo: null,
};

const custom: LocationPreference = {
  ...governorate,
  useCustomCoords: true,
  customLat: '52.52',
  customLon: '13.40',
  mode: 'custom',
};

describe('prayerTimeZone', () => {
  it('prefers a valid zone from the server', () => {
    expect(prayerTimeZone(custom, 'Europe/Berlin')).toBe('Europe/Berlin');
  });

  it('ignores an invalid server zone', () => {
    expect(prayerTimeZone(governorate, 'Not/AZone')).toBe(SYRIA_TIMEZONE);
  });

  it('reads a Syrian governorate in Damascus time', () => {
    expect(prayerTimeZone(governorate, null)).toBe(SYRIA_TIMEZONE);
  });

  it('falls back to the device zone for custom coordinates', () => {
    expect(prayerTimeZone(custom, null)).toBeUndefined();
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA zones and rejects anything else', () => {
    expect(isValidTimeZone('Asia/Damascus')).toBe(true);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});

describe('parseCachedPrayerTimes', () => {
  const timings = { Fajr: '04:30', Dhuhr: '12:10' };

  it('keeps the zone stored with the timings', () => {
    const raw = JSON.stringify({ v: 2, timings, timezone: 'Europe/Berlin' });
    expect(parseCachedPrayerTimes(raw)).toEqual({ v: 2, timings, timezone: 'Europe/Berlin' });
  });

  it('treats a legacy bare-timings entry as a miss so it is refetched with its zone', () => {
    expect(parseCachedPrayerTimes(JSON.stringify(timings))).toBeNull();
  });

  it('rejects missing or malformed entries', () => {
    expect(parseCachedPrayerTimes(null)).toBeNull();
    expect(parseCachedPrayerTimes('not json')).toBeNull();
    expect(parseCachedPrayerTimes(JSON.stringify({ v: 2, timings: null }))).toBeNull();
  });

  it('stores a missing zone as null', () => {
    const raw = JSON.stringify({ v: 2, timings });
    expect(parseCachedPrayerTimes(raw)?.timezone).toBeNull();
  });
});
