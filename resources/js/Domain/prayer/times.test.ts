import { describe, expect, it } from 'vitest';
import type { LocationPreference } from '../location/preference';
import { SYRIA_TIMEZONE } from '../geography/syria';
import { prayerTimeZone } from './times';
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
