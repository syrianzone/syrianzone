import { expect, test } from 'bun:test';
import { restoreSession } from './restore-session';

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
test('late bootstrap A cannot replace account B or its API token', async () => {
  const pending = deferred<string>();
  let epoch = 0, token = '';
  const initialEpoch = epoch;
  const restoring = restoreSession({ readToken: async () => 'token-A', setToken: value => { token = value; }, loadUser: () => pending.promise, isCurrent: () => epoch === initialEpoch });
  await Promise.resolve();
  expect(token).toBe('token-A');
  epoch++; token = 'token-B'; pending.resolve('user-A');
  expect(await restoring).toBeNull(); expect(token).toBe('token-B');
});
test('late Keychain read cannot restore a token after a newer session starts', async () => {
  const pending = deferred<string | null>();
  let current = true, writes = 0, fetches = 0;
  const restoring = restoreSession({ readToken: () => pending.promise, setToken: () => { writes++; }, loadUser: async () => { fetches++; return 'old-user'; }, isCurrent: () => current });
  current = false; pending.resolve('old-token');
  expect(await restoring).toBeNull(); expect(writes).toBe(0); expect(fetches).toBe(0);
});
