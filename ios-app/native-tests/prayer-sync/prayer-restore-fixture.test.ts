import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { createPrayerLocalJournal, prayerAppearanceKey, prayerFaithKey, prayerHomeKey, prayerJournalKey } from './prayer-local-journal';
import { restorePrayerFixture } from './prayer-restore-fixture';
import { memoryPrayerStore } from './memory-store.test-support';
import { homeHash } from './prayer-home-context';
import { defaultPreferences } from '../../src/features/Home/model';

const run = 'ABCDEF00-0000-4000-8000-000000000099', day = '2026-11-15';
const launch = { kind: 'prayer-restore' as const, gate: 'synthetic-fixture-key-0001', run, day };
const endpoint = 'https://127.0.0.1:9443/__native_fixture/prayer-sync';
const hash = async (value: string) => createHash('sha256').update(value).digest('hex');
function response(patch: Record<string, unknown> = {}, status = 200, url = endpoint): Response {
  const result = new Response(JSON.stringify({ journalVersion: 2, ok: true, nonce: run, day, phase: 0, pending: null, restored: true, closed: false, ...patch }),
    { status, headers: { 'Content-Type': 'application/json' } });
  Object.defineProperty(result, 'url', { value: url });
  return result;
}
async function fixture() {
  const values = new Map<string, string>([['unrelated', 'keep']]), removes: string[] = [];
  const local = createPrayerLocalJournal(memoryPrayerStore(values, () => {}, key => removes.push(key)), new URL(endpoint).origin, hash);
  const home = await homeHash(defaultPreferences, hash);
  await local.prepare(run, day, { version: 2, home101: home, home102: home, appearance101: 'dark', appearance102: 'dark', seed102: true },
    { userId: 101, settings: { ...defaultPreferences, theme: 'dark' }, phase: 0, pending: null });
  values.set(prayerFaithKey, JSON.stringify({ method: 3, methodChosen: false, prayerLog: { [day]: { Fajr: true } }, quranPage: 1, quranPageAt: 0 }));
  values.set(prayerHomeKey, JSON.stringify(defaultPreferences)); values.set(prayerAppearanceKey, 'dark');
  return { local, values, removes };
}
test('local restoration requires a real positive exact gate/nonce/day server rollback acknowledgement first', async () => {
  const f = await fixture();
  await expect(restorePrayerFixture(launch, f.local, (async () => response({}, 403)) as unknown as typeof fetch)).rejects.toThrow();
  expect(f.removes).toEqual([]); expect(f.values.has(prayerJournalKey)).toBe(true);
});
test('cold restoration removes only its three touched records and journal after exact bounded server confirmation', async () => {
  const f = await fixture(); let calls = 0;
  const transport = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls++; expect(input).toBe(endpoint); expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('omit'); expect(init?.redirect).toBe('error');
    expect(new Headers(init?.headers).get('Authorization')).toBeNull();
    expect(new Headers(init?.headers).get('X-Native-Fixture-Key')).toBe(launch.gate);
    expect(JSON.parse(String(init?.body))).toEqual({ nonce: run, day, action: 'restore' });
    return response();
  }) as typeof fetch;
  await expect(restorePrayerFixture(launch, f.local, transport)).resolves.toEqual({ journalVersion: 2, nonce: run, day, restored: true, serverRestored: true });
  expect(calls).toBe(1); expect(f.removes).toEqual([prayerFaithKey, prayerHomeKey, prayerAppearanceKey, prayerJournalKey]);
  expect([...f.values]).toEqual([['unrelated', 'keep']]);
});
test('foreign responses, phases, versions and flags cannot authorize deleting the local journal', async () => {
  for (const invalid of [response({ nonce: 'foreign' }), response({ day: '2026-11-14' }), response({ phase: 1 }), response({ journalVersion: 1 }), response({ journalVersion: undefined }),
    response({ pending: 1 }), response({ restored: false }), response({ closed: true }), response({}, 200, 'https://example.invalid/')]) {
    const f = await fixture(), before = [...f.values];
    await expect(restorePrayerFixture(launch, f.local, (async () => invalid) as unknown as typeof fetch)).rejects.toThrow();
    expect(f.removes).toEqual([]); expect([...f.values]).toEqual(before);
  }
});
