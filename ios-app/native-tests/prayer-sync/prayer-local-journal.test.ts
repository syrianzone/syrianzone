import { memoryPrayerStore } from './memory-store.test-support';
import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { hydrateHomePreferences } from '../../src/features/Home/hydrate';
import { defaultPreferences } from '../../src/features/Home/model';
import { createPrayerLocalJournal, prayerFaithKey, prayerJournalKey, prayerLocationKey } from './prayer-local-journal';
import { homeHash, type PrayerHomeContext } from './prayer-home-context';
const nonce = 'ABCDEF00-0000-4000-8000-000000000099', day = '2026-11-15';
const homeKey = 'syrian-zone.document.home.v1', appearanceKey = 'syrian-zone.appearance.v1';
const faith = { method: 3, methodChosen: false, prayerLog: {}, quranPage: 1, quranPageAt: 0 };
const preferences = { ...defaultPreferences, eventsGovernorate: 'دمشق' };
const settings = { ...preferences, theme: 'dark' };
const hash = async (value: string) => createHash('sha256').update(value).digest('hex');
async function fixture(initial: [string, string][] = []) {
  const values = new Map(initial), writes: string[] = [], removes: string[] = [];
  let failHomeOnce = false;
  const context: PrayerHomeContext = { version: 2, home101: await homeHash(preferences, hash), home102: await homeHash(preferences, hash), appearance101: 'dark', appearance102: 'dark', seed102: true };
  const store = memoryPrayerStore(values, key => writes.push(key), key => removes.push(key), () => {
    if (failHomeOnce) { failHomeOnce = false; throw new Error('Owned write failed.'); }
  });
  const journal = createPrayerLocalJournal(store, 'https://127.0.0.1:9443', hash);
  const prepare = (userId: 101 | 102 = 101, stage = { phase: 0, pending: null as number | null }) => journal.prepare(nonce, day, context,
    { userId, settings: userId === 101 ? settings : {}, ...stage });
  const adopt = async () => {
    const hydrated = await hydrateHomePreferences(defaultPreferences, settings, async value => { values.set(homeKey, JSON.stringify(value)); });
    values.set(appearanceKey, hydrated.appearance!);
    values.set(prayerFaithKey, JSON.stringify({ ...faith, prayerLog: { [day]: { Fajr: false } } }));
  };
  return { values, writes, removes, context, journal, prepare, adopt, failHome: () => { failHomeOnce = true; } };
}
test('all three touched local records restore exact original raw values and presence', async () => {
  for (const existing of [false, true]) {
    const homeRaw = JSON.stringify({ ...defaultPreferences, showWeather: false }, null, 2);
    const faithRaw = JSON.stringify({ ...faith, quranPage: 42 }, null, 2);
    const local = await fixture(existing ? [[homeKey, homeRaw], [appearanceKey, 'light'], [prayerFaithKey, faithRaw], ['unrelated', 'keep']] : [['unrelated', 'keep']]);
    await local.prepare(); expect(local.writes).toEqual([prayerJournalKey]);
    await local.adopt();
    if (existing) local.values.set(prayerFaithKey, JSON.stringify({ ...faith, quranPage: 42, prayerLog: { [day]: { Fajr: false } } }));
    await local.journal.restore(nonce, day);
    expect(local.values.get(homeKey)).toBe(existing ? homeRaw : undefined);
    expect(local.values.get(appearanceKey)).toBe(existing ? 'light' : undefined);
    expect(local.values.get(prayerFaithKey)).toBe(existing ? faithRaw : undefined);
    expect(local.values.get(prayerJournalKey)).toBeUndefined(); expect(local.values.get('unrelated')).toBe('keep');
  }
});
test('a real source empty-account transition is allowed only from the declared seed and appearance', async () => {
  const local = await fixture(); await local.prepare(); await local.adopt();
  await expect(local.prepare(102, { phase: 2, pending: 3 })).resolves.toEqual({ journalVersion: 2, nonce, day, ready: true });
  local.values.set(homeKey, JSON.stringify({ ...preferences, showWeather: false }));
  await expect(local.prepare(102, { phase: 2, pending: 3 })).rejects.toThrow();
  expect(local.writes).toEqual([prayerJournalKey]);
});
test('unknown current Home, appearance, location or reading changes retain every record', async () => {
  for (const change of ['home', 'appearance', 'location', 'reading']) {
    const local = await fixture(); await local.prepare(); await local.adopt();
    if (change === 'home') local.values.set(homeKey, JSON.stringify({ ...preferences, showEvents: false }));
    if (change === 'appearance') local.values.set(appearanceKey, 'unknown');
    if (change === 'location') local.values.set(prayerLocationKey, '{}');
    if (change === 'reading') local.values.set(prayerFaithKey, JSON.stringify({ ...faith, quranPage: 2 }));
    await expect(local.journal.restore(nonce, day)).rejects.toThrow();
    expect(local.removes).toEqual([]); expect(local.writes).toEqual([prayerJournalKey]); expect(local.values.has(prayerJournalKey)).toBe(true);
  }
});
test('normalizing account seed, invalid appearance and stale journal versions refuse before writes', async () => {
  const local = await fixture([[appearanceKey, 'unknown']]);
  await expect(local.prepare()).rejects.toThrow(); expect(local.writes).toEqual([]);
  const invalid = await fixture();
  await expect(invalid.journal.prepare(nonce, day, invalid.context, { userId: 101, phase: 0, pending: null,
    settings: { ...settings, customLinks: [{ id: 'x', name: ' spaced ', url: 'https://example.invalid/', icon: '' }] } })).rejects.toThrow();
  expect(invalid.writes).toEqual([]);
  const old = await fixture([[prayerJournalKey, JSON.stringify({ version: 1, nonce, day })]]);
  await expect(old.prepare()).rejects.toThrow(); expect(old.writes).toEqual([]);
});
test('partial local restore can resume from exact originals without widening allowed changes', async () => {
  const homeRaw = JSON.stringify({ ...defaultPreferences, showWeather: false });
  const local = await fixture([[homeKey, homeRaw]]); await local.prepare(); await local.adopt(); local.failHome();
  await expect(local.journal.restore(nonce, day)).rejects.toThrow();
  expect(local.values.has(prayerJournalKey)).toBe(true);
  await local.journal.restore(nonce, day);
  expect(local.values.get(homeKey)).toBe(homeRaw); expect(local.values.get(prayerFaithKey)).toBeUndefined();
  expect(local.values.get(appearanceKey)).toBeUndefined(); expect(local.values.get(prayerJournalKey)).toBeUndefined();
});
test('a missing cold journal cannot replace the original snapshot even with pristine values', async () => {
  const local = await fixture();
  await expect(local.prepare(101, { phase: 1, pending: null })).rejects.toThrow();
  await expect(local.prepare(102, { phase: 2, pending: 3 })).rejects.toThrow();
  expect(local.writes).toEqual([]);
});
test('existing account reading metadata that would change the exact local record refuses before writes', async () => {
  const local = await fixture();
  await expect(local.journal.prepare(nonce, day, local.context, { userId: 101, phase: 0, pending: null,
    settings: { ...settings, quranLastPage: 42, quranPageAt: 1 } })).rejects.toThrow();
  expect(local.writes).toEqual([]);
});

test('existing history, a selected method, reading timestamps and nonmanual locations refuse before writes', async () => {
  for (const patch of [{ prayerLog: { '2026-11-14': { Fajr: true } } }, { prayerLog: { [day]: { Fajr: false } } },
    { methodChosen: true }, { method: 5 }, { quranPageAt: 1 }]) {
    const local = await fixture([[prayerFaithKey, JSON.stringify({ ...faith, ...patch })]]);
    await expect(local.prepare()).rejects.toThrow(); expect(local.writes).toEqual([]);
  }
  const local = await fixture([[prayerLocationKey, JSON.stringify({ city: 'aleppo', mode: 'city', useCustomCoords: false, geo: null })]]);
  await expect(local.prepare()).rejects.toThrow(); expect(local.writes).toEqual([]);
});
test('different nonces, history and unexpected current records retain all owned snapshots', async () => {
  for (const change of ['nonce', 'history', 'reading', 'location', 'unexpected-prayer']) {
    const local = await fixture(); await local.prepare(); await local.adopt();
    if (change === 'history') local.values.set(prayerFaithKey, JSON.stringify({ ...faith, prayerLog: { '2026-11-14': { Isha: true } } }));
    if (change === 'reading') local.values.set(prayerFaithKey, JSON.stringify({ ...faith, quranPage: 2 }));
    if (change === 'location') local.values.set(prayerLocationKey, '{}');
    if (change === 'unexpected-prayer') local.values.set(prayerFaithKey, JSON.stringify({ ...faith, prayerLog: { [day]: { Isha: true } } }));
    const before = [...local.values];
    await expect(local.journal.restore(change === 'nonce' ? 'ABCDEF00-0000-4000-8000-000000000098' : nonce, day)).rejects.toThrow();
    expect([...local.values]).toEqual(before); expect(local.removes).toEqual([]); expect(local.values.has(prayerJournalKey)).toBe(true);
  }
});
test('a cold reopen verifies the existing nonce and exact phase without replacing its snapshot', async () => {
  const local = await fixture(); await local.prepare(); await local.adopt();
  await expect(local.prepare(101, { phase: 1, pending: null })).resolves.toEqual({ journalVersion: 2, nonce, day, ready: true });
  await expect(local.journal.prepare('ABCDEF00-0000-4000-8000-000000000098', day, local.context,
    { userId: 101, settings, phase: 1, pending: null })).rejects.toThrow();
  expect(local.writes).toEqual([prayerJournalKey]);
});
test('an unexpectedly missing original faith record is refused without recreation', async () => {
  const local = await fixture([[prayerFaithKey, JSON.stringify(faith)]]); await local.prepare(); await local.adopt();
  local.values.delete(prayerFaithKey);
  await expect(local.journal.restore(nonce, day)).rejects.toThrow();
  expect(local.values.get(prayerFaithKey)).toBeUndefined(); expect(local.removes).toEqual([]);
});
