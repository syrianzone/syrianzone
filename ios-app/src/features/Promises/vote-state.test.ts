import { expect, test } from 'bun:test';
import { createDocumentStore } from '../../platform/document-store';
import { beginVote, finishVote, promiseVoteKey, readVote, restoreChoice, subscribeVotes, voteRevision } from './vote-state';

test('a vote remains single-flight and broadcasts its completion across adaptive pane remounts', () => {
  const key = 'user:17:promise:9'; let notifications = 0;
  const unsubscribe = subscribeVotes(() => notifications++); const before = voteRevision();
  expect(beginVote(key)).toBe(true);
  expect(readVote(key).busy).toBe(true);
  expect(beginVote(key)).toBe(false);
  finishVote(key, { choice: true, votes: { yes: 7, no: 2 } });
  expect(readVote(key)).toEqual({ busy: false, choice: true, votes: { yes: 7, no: 2 }, error: null, needsLogin: false });
  expect(voteRevision()).toBeGreaterThan(before);
  expect(notifications).toBe(2);
  unsubscribe();
});

test('late local reads cannot overwrite a newer acknowledged choice or another owner', () => {
  const key = 'guest:promise:10'; beginVote(key); finishVote(key, { choice: false, votes: { yes: 1, no: 2 } });
  restoreChoice(key, true);
  expect(readVote(key).choice).toBe(false);
  expect(readVote('user:18:promise:10').choice).toBeNull();
  const other = 'user:18:promise:10'; beginVote(other); finishVote(other, { error: 'انتهت الجلسة', needsLogin: true });
  expect(readVote(other).busy).toBe(false);
  expect(readVote(other).needsLogin).toBe(true);
  expect(readVote(key).needsLogin).toBe(false);
});


test('promise choices round trip through the real document key contract for separate users and promises', async () => {
  const values = new Map<string, string>();
  const documents = createDocumentStore({
    getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); },
  });
  const decode = (value: unknown): boolean | null => {
    if (value !== null && typeof value !== 'boolean') throw new Error('Invalid saved vote');
    return value;
  };
  const first = promiseVoteKey(101, 12), second = promiseVoteKey(102, 12), guest = promiseVoteKey(null, 12);
  expect(await documents.read(first, decode, null)).toBeNull();
  await documents.write(first, true);
  await documents.write(second, false);
  expect(await documents.read(first, decode, null)).toBe(true);
  expect(await documents.read(second, decode, null)).toBe(false);
  expect(await documents.read(guest, decode, null)).toBeNull();
  expect(await documents.read(promiseVoteKey(101, 13), decode, null)).toBeNull();
});
