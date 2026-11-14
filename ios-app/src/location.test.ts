import { expect, test } from 'bun:test';
import { firstLocation } from './location';

test('stops the native location watcher after the first position', async () => {
  let stopped = false;
  const result = await firstLocation(async onPosition => {
    queueMicrotask(() => onPosition({ latitude: 33.5, longitude: 36.3 }));
    return { remove: () => { stopped = true; } };
  }, new AbortController().signal);
  expect(result).toEqual({ latitude: 33.5, longitude: 36.3 });
  await Promise.resolve();
  expect(stopped).toBe(true);
});

test('bounds a missing GPS fix and removes its native watcher', async () => {
  let stopped = false;
  await expect(firstLocation(async () => ({ remove: () => { stopped = true; } }), new AbortController().signal, 5)).rejects.toThrow('تعذر');
  expect(stopped).toBe(true);
});

test('aborting a pending native registration removes the late subscription', async () => {
  const controller = new AbortController();
  let register: ((value: { remove(): void }) => void) | undefined;
  let stopped = false;
  const result = firstLocation(() => new Promise(resolve => { register = resolve; }), controller.signal);
  controller.abort();
  await expect(result).rejects.toThrow();
  register?.({ remove: () => { stopped = true; } });
  await Promise.resolve();
  expect(stopped).toBe(true);
});
