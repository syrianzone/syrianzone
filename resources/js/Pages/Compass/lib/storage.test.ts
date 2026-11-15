import { afterEach, beforeEach, expect, it } from 'vitest';
import { clearLocal, removeLocalResult, takePendingAccountSave } from './storage';

const progressKey = 'sz-compass-v2-progress';
const resultsKey = 'sz-compass-v2-results';
const pendingKey = 'sz-compass-v2-pending-save';
const result = { id: 'local:one', answers: { 'axis#0': 2 } };
const descriptors = { window: Object.getOwnPropertyDescriptor(globalThis, 'window'), storage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage') };
beforeEach(() => {
  const values = new Map<string, string>();
  const storage: Storage = { get length() { return values.size; }, clear: () => values.clear(), getItem: key => values.get(key) ?? null, key: index => [...values.keys()][index] ?? null, removeItem: key => { values.delete(key); }, setItem: (key, value) => { values.set(key, String(value)); } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {}, writable: true });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage, writable: true });
  localStorage.setItem(resultsKey, JSON.stringify([result]));
  localStorage.setItem(pendingKey, JSON.stringify(result));
  localStorage.setItem(progressKey, JSON.stringify({ answers: {} }));
});
afterEach(() => {
  for (const [key, descriptor] of [['window', descriptors.window], ['localStorage', descriptors.storage]] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});
it('deleting a queued local result prevents its later login upload', () => {
  expect(removeLocalResult(result.id)).toEqual([]);
  expect(takePendingAccountSave()).toBeNull();
});
it('deleting a different result preserves the queued result', () => {
  removeLocalResult('other');
  expect(takePendingAccountSave()).toEqual(result);
});
it('clearing Compass history also clears pending account answers', () => {
  clearLocal();
  expect(localStorage.getItem(resultsKey)).toBeNull();
  expect(localStorage.getItem(progressKey)).toBeNull();
  expect(takePendingAccountSave()).toBeNull();
});
