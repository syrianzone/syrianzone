import { expect, test } from 'bun:test';
import { TokenDisclosure } from './disclosure';
const issued = { token: 'ephemeral-only', message: 'تم', abilities: [], dropped: [], expires: null };
test('leaving or hiding invalidates an in-flight plaintext response and closed account boundaries cannot reveal again', () => {
  const disclosure = new TokenDisclosure();
  const pending = disclosure.begin();
  disclosure.clear();
  expect(disclosure.offer(pending, issued)).toBe(false);
  expect(disclosure.snapshot()).toBeNull();
  const next = disclosure.begin();
  expect(disclosure.offer(next, issued)).toBe(true);
  expect(disclosure.snapshot()).toBe(issued);
  disclosure.clear();
  expect(disclosure.snapshot()).toBeNull();
  const last = disclosure.begin();
  disclosure.close();
  expect(disclosure.offer(last, issued)).toBe(false);
  expect(disclosure.offer(disclosure.begin(), issued)).toBe(false);
  expect(disclosure.snapshot()).toBeNull();
});
test('effect replay remounts only the current owner and invalidates earlier asynchronous tickets', () => {
  const disclosure = new TokenDisclosure(),
    unmount = disclosure.mount(),
    old = disclosure.begin();
  unmount();
  const cleanup = disclosure.mount();
  expect(disclosure.offer(old, issued)).toBe(false);
  expect(disclosure.offer(disclosure.begin(), issued)).toBe(true);
  cleanup();
  expect(disclosure.snapshot()).toBeNull();
});
