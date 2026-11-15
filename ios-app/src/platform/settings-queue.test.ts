import { expect, test } from 'bun:test';
import { createSettingsQueue } from './settings-queue';

test('serializes full settings responses and rejects queued writes after account changes', async () => {
  let identity: string | null = 'session1:user1';
  const calls: number[] = [], applied: number[] = [];
  let release: (() => void) | undefined;
  const queue = createSettingsQueue({ identity: () => identity, write: async patch => {
    calls.push(patch.n as number);
    if (patch.n === 1) await new Promise<void>(resolve => { release = resolve; });
    return patch;
  }, apply: value => { applied.push(value.n as number); } });
  const first = queue({ n: 1 }), second = queue({ n: 2 });
  await Promise.resolve(); expect(calls).toEqual([1]);
  release?.(); await first; await second;
  expect(applied).toEqual([1, 2]);
  const third = queue({ n: 3 }); identity = 'session2:user2';
  await expect(third).rejects.toThrow('الحساب');
  expect(calls).toEqual([1, 2]);
  await expect(queue({ n: 4 }, 'session1:user1')).rejects.toThrow('الحساب');
  expect(calls).toEqual([1, 2]);
});
test('a rejected request does not poison later settings saves', async () => {
  let calls = 0;
  const queue = createSettingsQueue({ identity: () => 'session', write: async patch => { if (++calls === 1) throw new Error('offline'); return patch; }, apply: () => undefined });
  await expect(queue({ a: 1 })).rejects.toThrow('offline');
  expect(await queue({ a: 2 })).toEqual({ a: 2 });
});
