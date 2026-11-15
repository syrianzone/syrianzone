import { expect, test } from 'bun:test';
import { legacyPersistence } from '../../src/platform/persistence-scope-model';
import { clearFixturePersonalStorage } from '../studio-cleanup';
const suffix = `.${'a'.repeat(64)}`;
const scope = { origin: 'https://127.0.0.1:9443', ...Object.fromEntries(Object.entries(legacyPersistence).map(([key, value]) => [key, value + suffix])) };
function fixture() {
  const values = new Map([['syrian-zone.document.syrian-zone.faith.preferences.v1', '{existing malformed faith/history bytes'],
    ['syrian-zone.document.syrian-zone.location.v1', 'existing location bytes'], ['native.fixture.prayer-sync.journal', 'retained recovery bytes'], ['unrelated', 'keep exactly']]);
  const calls: string[] = [];
  return { values, calls, store: { getAllKeysAsync: async () => { calls.push('keys'); return [...values.keys()]; },
    removeItemAsync: async (key: string) => { calls.push('remove:' + key); return values.delete(key); },
    clearAsync: async () => { calls.push('clear'); values.clear(); }, closeAsync: async () => { calls.push('close'); } } };
}
test('Prayer-only outer cleanup preserves every existing scoped value and only closes storage', async () => {
  const f = fixture(), before = [...f.values.entries()];
  await clearFixturePersonalStorage(scope, f.store, false, true);
  expect([...f.values.entries()]).toEqual(before);
  expect(f.calls).toEqual(['close']);
});
test('mixed preservation modes refuse before every storage operation', async () => {
  const f = fixture();
  await expect(clearFixturePersonalStorage(scope, f.store, true, true)).rejects.toThrow();
  expect(f.calls).toEqual([]);
});
test('the existing default cleanup branch remains a full clear and close', async () => {
  const f = fixture();
  await clearFixturePersonalStorage(scope, f.store, false);
  expect(f.values.size).toBe(0);
  expect(f.calls).toEqual(['clear', 'close']);
});
