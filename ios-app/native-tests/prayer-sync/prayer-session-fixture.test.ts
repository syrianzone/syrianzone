import { memoryPrayerStore } from './memory-store.test-support';
import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { preparePrayerSession } from './prayer-session-fixture';
import { createPrayerLocalJournal, prayerFaithKey, prayerJournalKey } from './prayer-local-journal';
import { homeHash } from './prayer-home-context';
import { defaultPreferences } from '../../src/features/Home/model';
const run = 'ABCDEF00-0000-4000-8000-000000000099', day = '2026-11-15', token = '1|synthetic-fresh-token-0001';
const launch = { kind: 'session' as const, user: 'member' as const, variant: 'prayer-sync' as const, gate: 'synthetic-fixture-key-0001', run, day };
const hash = async (value: string) => createHash('sha256').update(value).digest('hex');
async function scenario(fail: boolean, contextFailure = false, stage = { phase: 0, pending: null as number | null }) {
  const events: string[] = [], values = new Map<string, string>();
  if (fail) values.set(prayerFaithKey, '{invalid existing record');
  const local = createPrayerLocalJournal(memoryPrayerStore(values, () => events.push('journal')), 'https://127.0.0.1:9443', hash);
  const context = { version: 2, home101: await homeHash(defaultPreferences, hash), home102: await homeHash(defaultPreferences, hash), appearance101: 'dark', appearance102: 'dark', seed102: true };
  const transport = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers); let body: Record<string, unknown>;
    if (String(input).endsWith('/prayer-sync')) {
      events.push('context'); expect(headers.has('Authorization')).toBe(false); expect(headers.has('Cookie')).toBe(false);
      expect(JSON.parse(String(init?.body))).toEqual({ nonce: run, day, action: 'context' });
      body = { ok: true, nonce: run, day, journalVersion: 2, ...stage, restored: false, closed: false, context };
    } else {
      events.push('revoke'); expect(String(input)).toBe('https://127.0.0.1:9443/api/v1/auth/logout');
      expect(headers.get('Authorization')).toBe('Bearer ' + token); expect(headers.has('X-Native-Fixture-Key')).toBe(false); body = { ok: true };
    }
    const response = new Response(JSON.stringify(body), { status: contextFailure && events.at(-1) === 'context' ? 409 : 200, headers: { 'Content-Type': 'application/json' } });
    Object.defineProperty(response, 'url', { value: String(input) }); return response;
  }) as typeof fetch;
  return { events, values, local, transport };
}
test('valid preflight reads only closed context before its exact local snapshot', async () => {
  const s = await scenario(false);
  await preparePrayerSession(async () => s.local, launch, token, s.transport, { id: 101, settings: { ...defaultPreferences, theme: 'dark' } });
  expect(s.events).toEqual(['context', 'journal']); expect(s.values.has(prayerJournalKey)).toBe(true);
});
test('context and local preflight failures revoke only the fresh uninstalled verified token', async () => {
  for (const contextFailure of [false, true]) {
    const s = await scenario(true, contextFailure);
    await expect(preparePrayerSession(async () => s.local, launch, token, s.transport, { id: 101, settings: { ...defaultPreferences, theme: 'dark' } })).rejects.toThrow();
    expect(s.events).toEqual(['context', 'revoke']); expect(s.values.has(prayerJournalKey)).toBe(false);
    expect(s.values.get(prayerFaithKey)).toBe('{invalid existing record');
  }
});
test('opening the fixed local database is inside fresh-token refusal cleanup', async () => {
  const s = await scenario(false);
  await expect(preparePrayerSession(async () => { throw new Error('Owned database refused.'); }, launch, token, s.transport,
    { id: 101, settings: { ...defaultPreferences, theme: 'dark' } })).rejects.toThrow();
  expect(s.events).toEqual(['context', 'revoke']); expect(s.values.has(prayerJournalKey)).toBe(false);
});
test('fresh102 empty-array settings use armed context and the existing exact local seed', async () => {
  const s = await scenario(false, false, { phase: 2, pending: 3 });
  const context = { version: 2 as const, home101: await homeHash(defaultPreferences, hash), home102: await homeHash(defaultPreferences, hash), appearance101: 'dark' as const, appearance102: 'dark' as const, seed102: true };
  await s.local.prepare(run, day, context, { userId: 101, settings: { ...defaultPreferences, theme: 'dark' }, phase: 0, pending: null });
  s.values.set('syrian-zone.document.home.v1', JSON.stringify(defaultPreferences)); s.values.set('syrian-zone.appearance.v1', 'dark');
  s.values.set(prayerFaithKey, JSON.stringify({ method: 3, methodChosen: false, prayerLog: { [day]: { Fajr: false } }, quranPage: 1, quranPageAt: 0 }));
  await expect(preparePrayerSession(async () => s.local, { ...launch, user: 'other' }, token, s.transport, { id: 102, settings: [] })).resolves.toEqual({ journalVersion: 2, nonce: run, day, ready: true });
  expect(s.events).toEqual(['journal', 'context']);
});
