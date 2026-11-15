import { describe, expect, test } from 'bun:test';
import raw from '../../../../resources/data/crossings.json';
import { buildShareMessage, crossings, decodeCrossings, isWindowOpen, statusOf, syriaClock } from './model';

describe('crossing source schedule invariants', () => {
  test('loads every source crossing with native latitude/longitude order', () => {
    expect(crossings).toHaveLength(raw.crossings.length);
    expect(crossings[0]?.coordinate).toEqual({ latitude: 36.2301042, longitude: 36.69401527 });
    expect(new Set(crossings.map(item => item.n)).size).toBe(crossings.length);
  });
  test('ordinary windows include opening minute and exclude closing minute', () => {
    const window = { start: '09:00', end: '17:00' };
    expect([539, 540, 1019, 1020].map(minute => isWindowOpen(window, minute))).toEqual([false, true, true, false]);
  });
  test('overnight, equal endpoints and h24 retain source behavior', () => {
    expect([0, 299, 300, 539, 540, 1439].map(minute => isWindowOpen({ start: '09:00', end: '05:00' }, minute))).toEqual([true, true, false, false, true, true]);
    expect(isWindowOpen({ start: '09:00', end: '09:00' }, 0)).toBe(true);
    expect(isWindowOpen({ h24: true }, 600)).toBe(true);
  });
  test('opening soon precedes pending and override precedes ordinary windows', () => {
    const crossing = crossings[0]!;
    expect(statusOf({ ...crossing, openingSoon: true }, null)).toBe('opening');
    expect(statusOf(crossing, null)).toBe('pending');
    expect(statusOf({ ...crossing, override: { status: 'closed', message: 'مغلق مؤقتاً' } }, 600)).toBe('closed');
    expect(statusOf({ ...crossing, windows: [], override: { status: 'open' } }, 600)).toBe('open');
  });
  test('Damascus wall clock is independent of device timezone and date rollover', () => {
    expect(syriaClock(new Date('2026-11-14T22:30:45Z'))).toEqual({ text: '01:30:45', minutes: 90, offset: 'GMT+3' });
  });
  test('share resolves exact current schedule and includes canonical crossing URL', () => {
    const crossing = { ...crossings[0]!, windows: [{ start: '09:00', end: '17:00' }] };
    const text = buildShareMessage(crossing, new Date('2026-11-14T14:00:00Z'));
    expect(text).toContain('مغلق الآن');
    expect(text).toContain(`https://syrian.zone/crossings?c=${crossing.n}`);
    expect(text).toContain('+963 989 860 267');
  });
  test('rejects malformed coordinates, duplicate IDs and unsafe source URLs', () => {
    const first = raw.crossings[0]!;
    expect(() => decodeCrossings({ ...raw, crossings: [{ ...first, lat: NaN }] })).toThrow();
    expect(() => decodeCrossings({ ...raw, crossings: [{ ...first, lon: 181 }] })).toThrow();
    expect(() => decodeCrossings({ ...raw, crossings: [first, first] })).toThrow();
    expect(() => decodeCrossings({ ...raw, crossings: [{ ...first, mapsUrl: 'javascript:alert(1)' }] })).toThrow();
  });
  test('malformed work windows cannot silently publish an incorrect open status', () => {
    const first = raw.crossings[0]!;
    expect(() => decodeCrossings({ ...raw, crossings: [{ ...first, windows: [{ start: '27:00', end: '08:00' }] }] })).toThrow();
    expect(() => decodeCrossings({ ...raw, crossings: [{ ...first, windows: [{ end: '08:00' }] }] })).toThrow();
  });
});
