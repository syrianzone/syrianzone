import { expect, test } from 'bun:test';
import { createCredentialTransactions, type CredentialPort } from './credential-transactions';

function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function fixture(override: Partial<CredentialPort> = {}) {
  const values = new Map([['scope', 'original']]), writes: string[] = [];
  const port: CredentialPort = {
    read: async key => values.get(key) ?? null,
    write: async (key, value) => { writes.push(value); values.set(key, value); },
    remove: async key => { writes.push('removed'); values.delete(key); },
    ...override,
  };
  return { values, writes, port, transactions: createCredentialTransactions(port) };
}
test('cancelled delayed writes roll back before any queued or later restore can read the candidate token', async () => {
  const gate = deferred(); let current = true, adopted = false;
  const f = fixture();
  f.port.write = async (key, value) => { f.writes.push(value); f.values.set(key, value); if (value === 'candidate') await gate.promise; };
  const commit = f.transactions.replace('scope', 'candidate', () => current, () => { adopted = true; });
  await tick();
  expect(f.values.get('scope')).toBe('candidate');
  current = false;
  let restored = false;
  const restore = f.transactions.read('scope').then(value => { restored = true; return value; });
  await tick();
  expect(restored).toBe(false);
  gate.resolve();
  expect(await commit).toBe(false);
  expect(await restore).toBe('original');
  expect(await createCredentialTransactions(f.port).read('scope')).toBe('original');
  expect(adopted).toBe(false);
});
test('a newer legitimate session supersedes an in-flight candidate and cannot be deleted by its rollback', async () => {
  const gate = deferred(), f = fixture(); const adopted: string[] = [];
  f.port.write = async (key, value) => { f.writes.push(value); f.values.set(key, value); if (value === 'old-candidate') await gate.promise; };
  const older = f.transactions.replace('scope', 'old-candidate', () => true, () => { adopted.push('old'); });
  await tick();
  const newer = f.transactions.replace('scope', 'new-session', () => true, () => { adopted.push('new'); });
  gate.resolve();
  expect(await older).toBe(false);
  expect(await newer).toBe(true);
  expect(f.writes).toEqual(['old-candidate', 'original', 'new-session']);
  expect(await f.transactions.read('scope')).toBe('new-session');
  expect(adopted).toEqual(['new']);
});
test('failed partial writes and removals preserve the prior credential and never apply memory state', async () => {
  for (const next of ['candidate', null]) {
    let adopted = false; const f = fixture();
    f.port.write = async (key, value) => { f.values.set(key, value); if (value === 'candidate') throw new Error('write-failed'); };
    f.port.remove = async key => { f.values.delete(key); throw new Error('remove-failed'); };
    await expect(f.transactions.replace('scope', next, () => true, () => { adopted = true; })).rejects.toThrow();
    expect(await f.transactions.read('scope')).toBe('original');
    expect(adopted).toBe(false);
  }
});
test('an already stale clear cannot invalidate a newer valid transaction', async () => {
  const gate = deferred(), f = fixture();
  f.port.write = async (key, value) => { f.values.set(key, value); if (value === 'new-session') await gate.promise; };
  const newer = f.transactions.replace('scope', 'new-session', () => true, () => {});
  await tick();
  expect(await f.transactions.replace('scope', null, () => false, () => {})).toBe(false);
  gate.resolve();
  expect(await newer).toBe(true);
  expect(await f.transactions.read('scope')).toBe('new-session');
});
test('an in-flight logout cannot erase a newer login when its delayed deletion settles', async () => {
  const gate = deferred(), f = fixture(), adopted: string[] = [];
  f.port.remove = async key => { f.values.delete(key); await gate.promise; };
  const logout = f.transactions.replace('scope', null, () => true, () => { adopted.push('guest'); });
  await tick();
  const login = f.transactions.replace('scope', 'new-session', () => true, () => { adopted.push('new'); });
  gate.resolve();
  expect(await logout).toBe(false);
  expect(await login).toBe(true);
  expect(await createCredentialTransactions(f.port).read('scope')).toBe('new-session');
  expect(adopted).toEqual(['new']);
});
test('canceling a first login restores signed-out storage rather than leaving the candidate behind', async () => {
  const gate = deferred(), f = fixture(), controller = new AbortController();
  f.values.clear();
  f.port.write = async (key, value) => { f.values.set(key, value); await gate.promise; };
  const login = f.transactions.replace('scope', 'candidate', () => !controller.signal.aborted, () => { throw new Error('unexpected adoption'); });
  await tick(); controller.abort(); gate.resolve();
  expect(await login).toBe(false);
  expect(await createCredentialTransactions(f.port).read('scope')).toBeNull();
});
test('unreadable prior credentials fail before any replacement or memory adoption', async () => {
  const f = fixture({ read: async () => { throw new Error('locked'); } });
  let adopted = false;
  await expect(f.transactions.replace('scope', 'candidate', () => true, () => { adopted = true; })).rejects.toThrow('locked');
  expect(f.writes).toEqual([]);
  expect(f.values.get('scope')).toBe('original');
  expect(adopted).toBe(false);
});
test('origin queues stay separate and memory adoption runs before a reader can observe committed credentials', async () => {
  const gate = deferred(), f = fixture(); let current = true, adopted = false;
  f.port.write = async (key, value) => { f.values.set(key, value); if (key === 'scope') await gate.promise; };
  const pending = f.transactions.replace('scope', 'candidate', () => current, () => { adopted = true; current = false; });
  await tick();
  expect(await f.transactions.replace('other-origin', 'other', () => true, () => {})).toBe(true);
  expect(await f.transactions.read('other-origin')).toBe('other');
  gate.resolve();
  expect(await pending).toBe(true);
  expect(adopted).toBe(true);
  expect(await f.transactions.read('scope')).toBe('candidate');
});
test('failed rollback blocks credential reads until the prior value can be repaired', async () => {
  const gate = deferred(), f = fixture(); let current = true, repairsFail = true;
  f.port.write = async (key, value) => {
    if (value === 'original' && repairsFail) throw new Error('locked');
    f.values.set(key, value);
    if (value === 'candidate') await gate.promise;
  };
  const commit = f.transactions.replace('scope', 'candidate', () => current, () => {});
  await tick(); current = false; gate.resolve();
  await expect(commit).rejects.toThrow();
  await expect(f.transactions.read('scope')).rejects.toThrow();
  repairsFail = false;
  expect(await f.transactions.read('scope')).toBe('original');
});
