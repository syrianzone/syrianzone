import { expect, test } from 'bun:test';
import { createPendingSave } from './pending-save';

const result = { id: 'local:1', answers: { 'axis#0': 2 } };
function fixture() {
  let stored: typeof result | null = result;
  const changed: (typeof result | null)[] = [];
  const queue = createPendingSave<typeof result>(async value => { stored = value; }, value => changed.push(value));
  queue.restore(result);
  return { queue, changed, stored: () => stored };
}
test('deleting a queued result prevents a later login from uploading it', async () => {
  const { queue, stored } = fixture();
  await queue.remove(result.id);
  let uploads = 0;
  expect(await queue.consume(async () => { uploads += 1; return result; }, async () => {})).toBe(false);
  expect(uploads).toBe(0); expect(stored()).toBeNull(); expect(queue.current()).toBeNull();
});
test('clear-all removes pending answers while deleting another result preserves them', async () => {
  const { queue, stored } = fixture();
  await queue.remove('other'); expect(stored()).toEqual(result);
  await queue.remove(); expect(stored()).toBeNull();
});
test('deletion aborts an active upload and prevents its late response from recreating history', async () => {
  const { queue, stored } = fixture();
  let finish!: (value: typeof result) => void, signal!: AbortSignal;
  const adopted: (typeof result)[] = [];
  const operation = queue.consume((_value, cancellation) => { signal = cancellation; return new Promise<typeof result>(resolve => { finish = resolve; }); }, async value => { adopted.push(value); });
  await queue.remove(result.id);
  expect(signal.aborted).toBe(true);
  finish(result);
  expect(await operation).toBe(false); expect(adopted).toEqual([]); expect(stored()).toBeNull();
});
test('a failed pending-document deletion reports failure and preserves retryable answers', async () => {
  const queue = createPendingSave<typeof result>(async () => { throw new Error('storage unavailable'); }, () => {});
  queue.restore(result);
  await expect(queue.remove()).rejects.toThrow('storage unavailable');
  expect(queue.current()).toEqual(result);
});
test('retrying a failed queue clear after server acknowledgement never uploads the answers twice', async () => {
  let available = false, uploads = 0;
  const adopted: typeof result[] = [];
  const queue = createPendingSave<typeof result>(async () => { if (!available) throw new Error('storage unavailable'); }, () => {});
  queue.restore(result);
  const upload = async () => { uploads += 1; return result; };
  await expect(queue.consume(upload, async value => { adopted.push(value); })).rejects.toThrow('storage unavailable');
  available = true;
  expect(await queue.consume(upload, async value => { adopted.push(value); })).toBe(true);
  expect(uploads).toBe(1); expect(adopted).toEqual([result]); expect(queue.current()).toBeNull();
});
