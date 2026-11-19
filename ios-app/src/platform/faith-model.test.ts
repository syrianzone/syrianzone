import { describe, expect, test } from 'bun:test';
import { decodeFaithPreferences, defaultFaithPreferences, mergeFaithPreferences, prunePrayerLog, todayKey } from './faith-model';

describe('native faith preference compatibility', () => {
  test('uses the national date boundary even on a device in another timezone', () => {
    expect(todayKey(new Date('2026-11-14T22:00:00Z'))).toBe('2026-11-15');
    expect(todayKey(new Date('2026-11-14T20:00:00Z'))).toBe('2026-11-14');
  });
  test('keeps accepted legacy methods and limits logs to thirty-one days', () => {
    expect(decodeFaithPreferences({ method: 14 }).method).toBe(14);
    const log = Object.fromEntries(Array.from({ length: 35 }, (_, index) => [new Date(Date.UTC(2026, 9, index + 1)).toISOString().slice(0, 10), { Fajr: true }]));
    const pruned = prunePrayerLog(log);
    expect(Object.keys(pruned)).toHaveLength(31);
    expect(Object.keys(pruned)[0]).toBe('2026-10-05');
  });
  test('unions completed prayers and adopts the newer reading position', () => {
    const local = { ...defaultFaithPreferences, prayerLog: { '2026-11-14': { Fajr: true, Dhuhr: false } }, quranPage: 20, quranPageAt: 2000 };
    const merged = mergeFaithPreferences(local, { prayerLog: { '2026-11-14': { Dhuhr: true } }, quranLastPage: 30, quranPageAt: 3 });
    expect(merged.preferences.prayerLog['2026-11-14']).toEqual({ Fajr: true, Dhuhr: true });
    expect(merged.preferences.quranPage).toBe(30);
    expect(merged.preferences.quranPageAt).toBe(3000);
    expect(merged.serverPatch.prayerLog).toEqual(merged.preferences.prayerLog);
  });
  test('seeds an untouched device method but exposes a genuine explicit conflict', () => {
    expect(mergeFaithPreferences(defaultFaithPreferences, { muslimMethod: 5 }).preferences.method).toBe(5);
    const result = mergeFaithPreferences({ ...defaultFaithPreferences, methodChosen: true }, { muslimMethod: 5 });
    expect(result.methodConflict).toEqual({ local: 3, account: 5 });
    expect(result.serverPatch).not.toHaveProperty('muslimMethod');
    expect(result.preferences.method).toBe(3);
  });
});
