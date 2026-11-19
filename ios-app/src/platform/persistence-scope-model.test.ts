import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { createPersistenceScopes, createScopedStorage, legacyPersistence } from './persistence-scope-model';
test('canonical production preserves every legacy key and database without touching the hash service', async () => {
  let calls = 0;
  const resolve = createPersistenceScopes(async () => {
    calls++;
    throw new Error('must not hash production');
  });
  expect(await resolve('https://SYRIAN.zone:443/')).toEqual({
    origin: 'https://syrian.zone',
    ...legacyPersistence,
  });
  expect(calls).toBe(0);
});
test('parallel nonproduction consumers share one full native-digest boundary and cannot read production stores', async () => {
  const seen: string[] = [];
  const resolve = createPersistenceScopes(async (origin) => {
    seen.push(origin);
    return createHash('sha256').update(origin).digest('hex');
  });
  const [scope, same] = await Promise.all([
    resolve('https://127.0.0.1:9443'),
    resolve('https://127.0.0.1:9443/'),
  ]);
  expect(scope).toBe(same);
  expect(seen).toEqual(['https://127.0.0.1:9443']);
  const digest = createHash('sha256').update('https://127.0.0.1:9443').digest('hex');
  for (const key of ['tokenKey', 'databaseName', 'deviceKey', 'guestIdentityKey'] as const) {
    expect(scope[key]).toBe(`${legacyPersistence[key]}.${digest}`);
    expect(scope[key]).not.toBe(legacyPersistence[key]);
  }
  expect((await resolve('https://127.0.0.1:9444')).tokenKey).not.toBe(scope.tokenKey);
});
test('invalid origins or malformed hash output fail closed and a transient native hash failure can retry', async () => {
  for (const origin of ['http://127.0.0.1:9443', 'https://host.test/path', 'https://user:password@host.test'])
    await expect(createPersistenceScopes(async () => 'a'.repeat(64))(origin)).rejects.toThrow();
  await expect(createPersistenceScopes(async () => 'abcd')('https://host.test')).rejects.toThrow();
  let attempt = 0;
  const resolve = createPersistenceScopes(async () => {
    if (++attempt === 1) throw new Error('locked');
    return 'a'.repeat(64);
  });
  await expect(resolve('https://host.test')).rejects.toThrow('locked');
  expect((await resolve('https://host.test')).tokenKey).toEndWith('a'.repeat(64));
});
test('personal reads and writes await the isolated database and never open legacy storage for a fixture', async () => {
  const opened: string[] = [],
    reads: string[] = [],
    writes: string[] = [];
  const scope = createPersistenceScopes(async () => 'b'.repeat(64));
  const scoped = createScopedStorage(
    () => scope('https://127.0.0.1:9443'),
    (name) => {
      opened.push(name);
      return {
        getItemAsync: async (key: string) => {
          reads.push(key);
          return null;
        },
        setItemAsync: async (key: string, value: string) => {
          writes.push(`${key}:${value}`);
        },
      };
    },
  );
  await Promise.all([scoped.storage.getItemAsync('saved'), scoped.storage.setItemAsync('board', '{}')]);
  expect(opened).toEqual([`ExpoSQLiteStorage.${'b'.repeat(64)}`]);
  expect(reads).toEqual(['saved']);
  expect(writes).toEqual(['board:{}']);
  expect(opened).not.toContain(legacyPersistence.databaseName);
});
