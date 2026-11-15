import { expect, test } from 'bun:test';
import { legacyPersistence } from '../src/platform/persistence-scope-model';
import { clearFixturePersonalStorage } from './studio-cleanup';
import { requireAbsentStudioPending } from './studio-fixture-model';

const suffix = `.${'a'.repeat(64)}`;
const scope = { origin: 'https://127.0.0.1:9443', ...Object.fromEntries(Object.entries(legacyPersistence).map(([key, value]) => [key, value + suffix])) };
const pendingKey = 'syrian-zone.document.transit-studio.pending.v1';
function storage(values: [string, string][]) {
  const rows = new Map(values), calls: string[] = [];
  return { rows, calls,
    getItemAsync: async (key: string) => { calls.push('read:' + key); return rows.get(key) ?? null; },
    getAllKeysAsync: async () => { calls.push('keys'); return [...rows.keys()]; },
    removeItemAsync: async (key: string) => { calls.push('remove:' + key); return rows.delete(key); },
    clearAsync: async () => { calls.push('clear'); rows.clear(); },
    closeAsync: async () => { calls.push('close'); } };
}

test('default fixture cleanup still clears its complete isolated store and closes it', async () => {
  const local = storage([[pendingKey, 'private'], ['other', 'ordinary']]);
  await clearFixturePersonalStorage(scope, local, false);
  expect(local.rows.size).toBe(0); expect(local.calls).toEqual(['clear', 'close']);
});
test('Studio cleanup removes only other scoped keys without reading or rewriting pending bytes', async () => {
  const bytes = '  {"private":"untouched pending drawing"}\n';
  const local = storage([[pendingKey, bytes], [pendingKey + '.extra', 'ordinary'], ['ordinary', 'ordinary']]);
  await clearFixturePersonalStorage(scope, local, true);
  expect([...local.rows.entries()]).toEqual([[pendingKey, bytes]]);
  expect(local.calls).toEqual(['keys', 'remove:' + pendingKey + '.extra', 'remove:ordinary', 'close']);
});
test('a refused pending document remains byte-identical through the runner cleanup path', async () => {
  const bytes = '{not even valid JSON';
  const local = storage([[pendingKey, bytes], ['own-fixture-cache', 'ordinary']]);
  await expect(requireAbsentStudioPending(local)).rejects.toThrow('refuses an existing pending document');
  local.calls.length = 0;
  await clearFixturePersonalStorage(scope, local, true);
  expect([...local.rows.entries()]).toEqual([[pendingKey, bytes]]);
  expect(local.calls).toEqual(['keys', 'remove:own-fixture-cache', 'close']);
});
test('cleanup refuses canonical, mismatched and remote scopes before every storage operation', async () => {
  for (const invalid of [{ origin: scope.origin, ...legacyPersistence }, { ...scope, origin: 'https://syrian.zone' },
    { ...scope, databaseName: `ExpoSQLiteStorage.${'b'.repeat(64)}` }]) {
    const local = storage([[pendingKey, 'private'], ['other', 'ordinary']]);
    await expect(clearFixturePersonalStorage(invalid, local, true)).rejects.toThrow('persistence boundary rejected');
    expect(local.calls).toEqual([]); expect(local.rows.size).toBe(2);
  }
});
test('partial removal failures close storage and retain the untouched pending key', async () => {
  const local = storage([[pendingKey, 'private'], ['other', 'ordinary']]);
  const failure = new Error('test removal failed');
  local.removeItemAsync = async key => { local.calls.push('failed:' + key); throw failure; };
  await expect(clearFixturePersonalStorage(scope, local, true)).rejects.toBe(failure);
  expect(local.rows.get(pendingKey)).toBe('private'); expect(local.calls).toEqual(['keys', 'failed:other', 'close']);
});
