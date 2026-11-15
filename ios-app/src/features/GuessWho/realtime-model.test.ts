import { expect, test } from 'bun:test';
import { guestAuthorizer, serializedLifecycle } from './realtime-model';
test('guest authorizer refuses another room and turns transport failure into failed auth', async () => {
  const failures: string[] = []; let calls = 0;
  const authorize = guestAuthorizer('room-one', async () => { calls++; throw new Error('offline'); }, message => failures.push(message));
  expect(await authorize('presence-guesswho.room-two', '1.2')).toEqual({});
  expect(calls).toBe(0);
  expect(await authorize('presence-guesswho.room-one', '1.2')).toEqual({});
  expect(calls).toBe(1); expect(failures).toHaveLength(2);
});
test('native connection lifecycle work is serialized even after a failed setup', async () => {
  const queue = serializedLifecycle(); const order: string[] = [];
  const first = queue(async () => { order.push('first'); throw new Error('setup'); });
  const second = queue(async () => { order.push('second'); });
  await expect(first).rejects.toThrow(); await second;
  expect(order).toEqual(['first', 'second']);
});
