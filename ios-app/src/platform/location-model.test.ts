import { describe, expect, test } from 'bun:test';
import { accountPatchForLocation, decodeLocation, defaultLocation, resolvePrayerParams, resolveWeatherPoint } from './location-model';

describe('shared native location preference', () => {
  test('uses a valid active GPS point before manual coordinates and city', () => {
    const preference = { ...defaultLocation, mode: 'gps' as const, useCustomCoords: true, customLat: '51.5', customLon: '-0.1',
      geo: { lat: 52.37, lon: 4.9, source: 'gps' as const, label: 'موقع الجهاز', at: 10 } };
    expect(resolvePrayerParams(preference, 3)).toEqual({ latitude: 52.37, longitude: 4.9, method: 3 });
    expect(resolveWeatherPoint(preference)).toEqual({ lat: 52.37, lon: 4.9 });
    expect(resolveWeatherPoint({ ...preference, mode: 'city', useCustomCoords: false })).toEqual({ lat: 33.5138, lon: 36.2765 });
  });

  test('accepts zero and worldwide manual coordinates but rejects incomplete and invalid pairs', () => {
    expect(resolvePrayerParams({ ...defaultLocation, mode: 'custom', customLat: '0', customLon: '0' }, 4))
      .toEqual({ latitude: 0, longitude: 0, method: 4 });
    for (const [customLat, customLon] of [['', '36'], ['90.1', '36'], ['33', '-181'], ['NaN', '36'], [' ', ' ']]) {
      expect(resolvePrayerParams({ ...defaultLocation, mode: 'custom', customLat: customLat ?? '', customLon: customLon ?? '' }, 3))
        .toEqual({ governorate: 'damascus', method: 3 });
    }
  });

  test('validates stored location instead of trusting old coordinates or unknown cities', () => {
    expect(decodeLocation({ city: 'unknown', mode: 'gps', geo: { lat: 100, lon: 5, label: 'bad', source: 'gps', at: 1 } }))
      .toEqual({ ...defaultLocation, mode: 'gps' });
    expect(decodeLocation(null)).toEqual(defaultLocation);
  });

  test('account patch excludes device GPS/IP and preserves clearing manual fields', () => {
    expect(accountPatchForLocation({ mode: 'gps', geo: { lat: 52, lon: 4, label: 'GPS', source: 'gps', at: 100 } })).toEqual({});
    expect(accountPatchForLocation({ city: 'aleppo', customLat: '', customLon: '0', useCustomCoords: true }))
      .toEqual({ governorate: 'aleppo', customLat: null, customLon: 0, useCustomCoords: true });
    expect(accountPatchForLocation({ customLat: 'not a number' })).toEqual({});
  });
});
