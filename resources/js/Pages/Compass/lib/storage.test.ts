import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CompassResult } from '@/Domain/compass/types';
import { api } from '@/Lib/api';
import { clearLocal, removeLocalResult, savePendingResultToAccount, setPendingAccountSave } from './storage';

const progressKey = 'sz-compass-v2-progress';
const resultsKey = 'sz-compass-v2-results';
const pendingKey = 'sz-compass-v2-pending-save';
const result: CompassResult = {
  id: 'local:one', version: 'short', answers: { 'axis#0': 2 }, scores: {},
  align: { west: 0, gulf: 0, turkish: 0, east: 0, neutral: 0 },
  topFigure: null, topScore: null, spectrum: null, consistency: 1, answered: 1, createdAt: '2026-01-01T00:00:00Z',
};
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
  vi.restoreAllMocks();
  for (const [key, descriptor] of [['window', descriptors.window], ['localStorage', descriptors.storage]] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});
it('deleting a queued local result prevents its later login upload', () => {
  expect(removeLocalResult(result.id)).toEqual([]);
  expect(localStorage.getItem(pendingKey)).toBeNull();
});
it('deleting a different result preserves the queued result', () => {
  removeLocalResult('other');
  expect(localStorage.getItem(pendingKey)).toBe(JSON.stringify(result));
});
it('clearing Compass history also clears pending account answers', () => {
  clearLocal();
  expect(localStorage.getItem(resultsKey)).toBeNull();
  expect(localStorage.getItem(progressKey)).toBeNull();
  expect(localStorage.getItem(pendingKey)).toBeNull();
});

function startUpload() {
  const request = Promise.withResolvers<CompassResult>();
  vi.spyOn(api, 'post').mockReturnValueOnce(request.promise);
  return { ...request, upload: savePendingResultToAccount() };
}

it('a rejected upload cannot requeue a result deleted while the request was pending', async () => {
  const { reject, upload } = startUpload();
  removeLocalResult(result.id);
  reject(new Error('offline'));
  await upload.catch(() => {});
  expect(localStorage.getItem(pendingKey)).toBeNull();
});

it('a rejected upload cannot restore the queue after clearing history', async () => {
  const { reject, upload } = startUpload();
  clearLocal();
  reject(new Error('offline'));
  await upload.catch(() => {});
  expect(localStorage.getItem(pendingKey)).toBeNull();
});

it('a rejected upload preserves a newer queue entry for the same result', async () => {
  const { reject, upload } = startUpload();
  const newer = { ...result, statsConsent: true };
  setPendingAccountSave(newer);
  reject(new Error('offline'));
  await upload.catch(() => {});
  expect(localStorage.getItem(pendingKey)).toBe(JSON.stringify(newer));
});

it('a rejected upload requeues an unchanged result for a later visit', async () => {
  const { reject, upload } = startUpload();
  const error = new Error('offline');
  reject(error);
  await expect(upload).rejects.toBe(error);
  expect(localStorage.getItem(pendingKey)).toBe(JSON.stringify(result));
});

it('only the current attempt submits and clears the queued result', async () => {
  const { resolve, upload } = startUpload();
  await expect(savePendingResultToAccount()).resolves.toBe(false);
  expect(api.post).toHaveBeenCalledTimes(1);
  resolve({ ...result, id: 42 });
  await expect(upload).resolves.toBe(true);
  expect(localStorage.getItem(pendingKey)).toBeNull();
  expect(localStorage.getItem(resultsKey)).toBe(JSON.stringify([{ ...result, id: 42, savedToAccount: true }]));
});
