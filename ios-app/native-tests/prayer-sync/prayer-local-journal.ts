import type { PrayerLocalRaw, PrayerOriginals } from './prayer-local-store';
import { canonical, canonicalOwnedHome, decodePrayerHomeContext, homeHash, localHome, sourceHomeTransition, type PrayerHomeContext } from './prayer-home-context';
import { mergeFaithPreferences } from '../../src/platform/faith-model';
export const prayerFaithKey = 'syrian-zone.document.syrian-zone.faith.preferences.v1';
export const prayerLocationKey = 'syrian-zone.document.syrian-zone.location.v1';
export const prayerHomeKey = 'syrian-zone.document.home.v1';
export const prayerAppearanceKey = 'syrian-zone.appearance.v1';
export const prayerJournalKey = 'native.fixture.prayer-sync.journal';
interface Store { getItemAsync(key: string): Promise<string | null>; armJournal(before: PrayerLocalRaw, encoded: string): Promise<void>; restoreJournal(before: PrayerLocalRaw, encoded: string, original: PrayerOriginals): Promise<void> }
interface Faith { method: 3; methodChosen: false; prayerLog: Record<string, Record<string, boolean>>; quranPage: number; quranPageAt: 0 }
interface Journal { version: 2; nonce: string; day: string; faithRaw: string | null; homeRaw: string | null; appearanceRaw: string | null; untouchedFaith: string; location: string; context: PrayerHomeContext }
interface Entry { userId: 101 | 102; settings: Record<string, unknown>; phase: number; pending: number | null }
const fail = (): never => { throw new Error('The exact local Prayer snapshot or restoration was refused.'); };
function identity(nonce: string, day: string): void {
  if (!/^[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}$/.test(nonce)
    || !/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day) fail();
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  return value as Record<string, unknown>;
}
function faith(raw: string | null, day: string): Faith {
  if (raw !== null && raw.length > 16000) fail();
  const value = object(raw === null ? { method: 3, methodChosen: false, prayerLog: {}, quranPage: 1, quranPageAt: 0 } : JSON.parse(raw));
  if (Object.keys(value).sort().join(',') !== 'method,methodChosen,prayerLog,quranPage,quranPageAt' || value.method !== 3 || value.methodChosen !== false
    || !Number.isInteger(value.quranPage) || Number(value.quranPage) < 1 || Number(value.quranPage) > 604 || value.quranPageAt !== 0) fail();
  const log = object(value.prayerLog), days = Object.keys(log);
  if (days.length > 1 || days.some(key => key !== day)) fail();
  const expected = [{}, { Fajr: true }, { Fajr: false }, { Fajr: false, Dhuhr: true }, { Fajr: false, Dhuhr: false }];
  const today = days.length ? object(log[day]) : {};
  const entries = (row: Record<string, unknown>) => JSON.stringify(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)));
  if (!expected.some(row => entries(row) === entries(today))) fail();
  return value as unknown as Faith;
}
function manualLocation(raw: string | null): void {
  if (raw === null) return;
  const location = object(JSON.parse(raw));
  if (location.city !== 'damascus' || location.mode !== 'city' || location.useCustomCoords !== false || location.geo !== null) fail();
}

// Caller verifies the origin scope and obtains context only from its armed server journal.
export function createPrayerLocalJournal(store: Store, origin: string, hash: (value: string) => Promise<string>) {
  if (origin !== 'https://127.0.0.1:9443') fail();
  const digest = async (value: unknown): Promise<string> => {
    const result = await hash(JSON.stringify(value));
    if (!/^[a-f0-9]{64}$/.test(result)) fail();
    return result;
  };
  const untouched = (value: Faith) => ({ quranPage: value.quranPage, quranPageAt: value.quranPageAt });
  const rawValues = async () => {
    const [faithRaw, homeRaw, appearanceRaw, locationRaw] = await Promise.all([
      store.getItemAsync(prayerFaithKey), store.getItemAsync(prayerHomeKey), store.getItemAsync(prayerAppearanceKey), store.getItemAsync(prayerLocationKey),
    ]);
    return { faithRaw, homeRaw, appearanceRaw, locationRaw };
  };
  const appearance = (raw: string | null) => { if (raw !== null && raw !== 'light' && raw !== 'dark') fail(); };
  const read = async (nonce: string, day: string): Promise<Journal | null> => {
    identity(nonce, day);
    const raw = await store.getItemAsync(prayerJournalKey);
    if (raw === null) return null;
    if (raw.length > 100000) fail();
    const row = object(JSON.parse(raw));
    if (Object.keys(row).sort().join(',') !== 'appearanceRaw,context,day,faithRaw,homeRaw,location,nonce,untouchedFaith,version'
      || row.version !== 2 || row.nonce !== nonce || row.day !== day
      || ![row.faithRaw, row.homeRaw, row.appearanceRaw].every(value => value === null || typeof value === 'string')
      || typeof row.untouchedFaith !== 'string' || !/^[a-f0-9]{64}$/.test(row.untouchedFaith)
      || typeof row.location !== 'string' || !/^[a-f0-9]{64}$/.test(row.location)) fail();
    const journal = { ...row, context: decodePrayerHomeContext(row.context) } as unknown as Journal;
    appearance(journal.appearanceRaw); localHome(journal.homeRaw);
    const originalFaith = faith(journal.faithRaw, day);
    if (Object.keys(originalFaith.prayerLog).length || await digest(untouched(originalFaith)) !== journal.untouchedFaith) fail();
    return journal;
  };
  const current = async (nonce: string, day: string) => {
    const journalRaw = await store.getItemAsync(prayerJournalKey);
    const journal = await read(nonce, day);
    if (!journal || journalRaw === null || canonical(JSON.parse(journalRaw)) !== canonical(journal)) return fail();
    const values = await rawValues(), value = faith(values.faithRaw, day);
    if (journal.faithRaw !== null && values.faithRaw === null) fail();
    manualLocation(values.locationRaw);
    if (await digest(values.locationRaw) !== journal.location || await digest(untouched(value)) !== journal.untouchedFaith) fail();
    if (values.homeRaw !== journal.homeRaw) {
      const currentHome = values.homeRaw;
      if (currentHome === null) return fail();
      await canonicalOwnedHome(currentHome, [journal.context.home101, journal.context.home102], hash);
    }
    if (values.appearanceRaw !== journal.appearanceRaw && values.appearanceRaw !== journal.context.appearance101
      && values.appearanceRaw !== journal.context.appearance102) fail();
    return { journal, values, journalRaw };
  };
  return {
    async prepare(nonce: string, day: string, inputContext: PrayerHomeContext, entry: Entry): Promise<{ journalVersion: 2; nonce: string; day: string; ready: true }> {
      identity(nonce, day);
      const context = decodePrayerHomeContext(inputContext);
      if (!(entry.userId === 101 && [0, 1].includes(entry.phase) && entry.pending === null
        || entry.userId === 102 && (entry.phase === 2 && entry.pending === 3 || entry.phase === 4 && entry.pending === null))) fail();
      const previous = await read(nonce, day);
      if (!previous && (entry.userId !== 101 || entry.phase !== 0 || entry.pending !== null)) fail();
      const values = previous ? (await current(nonce, day)).values : await rawValues();
      if (previous && canonical(previous.context) !== canonical(context)) fail();
      const value = faith(values.faithRaw, day);
      manualLocation(values.locationRaw); appearance(values.appearanceRaw); localHome(values.homeRaw);
      if (!previous && Object.keys(value.prayerLog).length) fail();
      const faithTransition = mergeFaithPreferences(value, entry.settings);
      if (faithTransition.preferences.method !== 3 || faithTransition.preferences.methodChosen
        || canonical(untouched(faithTransition.preferences as Faith)) !== canonical(untouched(value))
        || Object.keys(faithTransition.serverPatch).some(key => key !== 'prayerLog')) fail();
      const transition = await sourceHomeTransition(values.homeRaw, entry.settings, hash);
      const targetHash = entry.userId === 101 ? context.home101 : context.home102;
      const targetAppearance = entry.userId === 101 ? context.appearance101 : context.appearance102;
      const seeding = entry.userId === 102 && entry.phase === 2 && context.seed102;
      if (transition.hash !== targetHash || transition.seedAccount !== seeding
        || transition.appearance !== null && transition.appearance !== targetAppearance
        || entry.userId === 101 && entry.settings.theme !== context.appearance101) fail();
      if (seeding && (await homeHash(localHome(values.homeRaw), hash) !== context.home101 || values.appearanceRaw !== context.appearance101)) fail();
      if (!previous) {
        const journal: Journal = { version: 2, nonce, day, faithRaw: values.faithRaw, homeRaw: values.homeRaw, appearanceRaw: values.appearanceRaw,
          untouchedFaith: await digest(untouched(value)), location: await digest(values.locationRaw), context };
        const encoded = JSON.stringify(journal);
        if (encoded.length > 100000) fail();
        await store.armJournal(values, encoded);
      }
      return { journalVersion: 2, nonce, day, ready: true };
    },
    async restore(nonce: string, day: string): Promise<{ journalVersion: 2; nonce: string; day: string; restored: true }> {
      const { journal, values, journalRaw } = await current(nonce, day);
      await store.restoreJournal(values, journalRaw, { faithRaw: journal.faithRaw, homeRaw: journal.homeRaw, appearanceRaw: journal.appearanceRaw });
      const restored = await rawValues();
      if (restored.faithRaw !== journal.faithRaw || restored.homeRaw !== journal.homeRaw || restored.appearanceRaw !== journal.appearanceRaw
        || await digest(restored.locationRaw) !== journal.location || await store.getItemAsync(prayerJournalKey) !== null) fail();
      return { journalVersion: 2, nonce, day, restored: true };
    },
  };
}

