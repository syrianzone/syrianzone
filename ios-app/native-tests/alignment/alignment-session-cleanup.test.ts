import { expect, test } from 'bun:test';
import { legacyPersistence } from '../../src/platform/persistence-scope-model';
import { clearFixturePersonalStorage } from '../studio-cleanup';
import { parseAlignmentFixtureLaunch } from './alignment-launch-model';
import { prepareAlignmentSession, type AlignmentTransport } from './alignment-session-fixture';

const scope = { origin: 'https://127.0.0.1:9443', ...Object.fromEntries(Object.entries(legacyPersistence).map(([key, value]) => [key, value + `.${'a'.repeat(64)}`])) };
const document = 'syrian-zone.document.alignment.v1', owner = 'syrian-zone.native-fixture.alignment-owner.v1';
function storage() {
  const rows = new Map([[document, '{private invalid original'], [owner, '{private original proof'], ['unrelated', 'ordinary']]);
  const calls: string[] = [];
  return { rows, calls, getAllKeysAsync: async () => { calls.push('keys'); return [...rows.keys()]; },
    removeItemAsync: async (key: string) => { calls.push('remove:' + key); return rows.delete(key); },
    clearAsync: async () => { calls.push('clear'); rows.clear(); }, closeAsync: async () => { calls.push('close'); } };
}

test('Alignment refusal cleanup preserves both unknown raw keys without reading, decoding, rewriting or broad clear', async () => {
  const local = storage();
  await clearFixturePersonalStorage(scope, local, false, false, true);
  expect([...local.rows]).toEqual([[document, '{private invalid original'], [owner, '{private original proof']]);
  expect(local.calls).toEqual(['keys', 'remove:unrelated', 'close']);
  for (const [studio, prayer] of [[true, false], [false, true], [true, true]]) {
    const refused = storage();
    await expect(clearFixturePersonalStorage(scope, refused, studio!, prayer!, true)).rejects.toThrow('Mixed');
    expect(refused.calls).toEqual([]); expect(refused.rows.size).toBe(3);
  }
  const foreign = storage();
  await expect(clearFixturePersonalStorage({ ...scope, origin: 'https://syrian.zone' }, foreign, false, false, true)).rejects.toThrow();
  expect(foreign.calls).toEqual([]);
});

test('ordinary cleanup remains clear-and-close; Prayer preserves all and Studio only its original exact key', async () => {
  const ordinary = storage(); await clearFixturePersonalStorage(scope, ordinary, false); expect(ordinary.calls).toEqual(['clear', 'close']);
  const prayer = storage(); await clearFixturePersonalStorage(scope, prayer, false, true); expect(prayer.calls).toEqual(['close']); expect(prayer.rows.size).toBe(3);
  const studio = storage(); studio.rows.set('syrian-zone.document.transit-studio.pending.v1', 'private drawing');
  await clearFixturePersonalStorage(scope, studio, true); expect([...studio.rows]).toEqual([['syrian-zone.document.transit-studio.pending.v1', 'private drawing']]);
});

test('verified fresh sessions are revoked on refusal and successful cold close, and never on successful adoption', async () => {
  const token = '1|synthetic-local-token-00001', requests: RequestInit[] = [];
  const transport: AlignmentTransport = async (input, init) => {
    expect(String(input)).toBe('https://127.0.0.1:9443/api/v1/auth/logout'); requests.push(init!);
    const result = new Response(JSON.stringify({ ok: true }), { status: 200 }); Object.defineProperty(result, 'url', { value: String(input) }); return result;
  };
  const launch = parseAlignmentFixtureLaunch(scope.origin, 'syrianzone://fixture/session?user=member&variant=alignment&run=12345678-1234-4234-8234-123456789ABC&stage=fresh#synthetic-local-gate-12345')!;
  const refused = new Error('refused without mutation');
  await expect(prepareAlignmentSession(launch, 101, token, transport, async () => { throw refused; })).rejects.toBe(refused);
  expect(requests.length).toBe(1); expect(requests[0]).toMatchObject({ method: 'POST', credentials: 'omit', redirect: 'error', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
  expect(await prepareAlignmentSession(launch, 101, token, transport, async () => 'ready')).toBe('ready'); expect(requests.length).toBe(1);
  expect(await prepareAlignmentSession({ ...launch, stage: 'close' }, 101, token, transport, async () => 'closed')).toBe('closed'); expect(requests.length).toBe(2);
  let ran = false;
  await expect(prepareAlignmentSession(launch, 103, token, transport, async () => { ran = true; })).rejects.toThrow();
  expect(ran).toBe(false); expect(requests.length).toBe(3);
  await expect(prepareAlignmentSession(launch, 101, token, async () => new Response('{}', { status: 403 }), async () => { throw refused; })).rejects.toThrow('could not be revoked');
});
