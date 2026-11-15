import { expect, test } from 'bun:test';
import { createDocumentStore } from '../../platform/document-store';
import { ballot, pollCooldownKey, decodeTierPage, initialBoard, moveCandidates, seriesData, shuffled } from './model';
const id = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
const page = { poll: { id: id(1), slug: 'best-ministers', title: 'اختبار' }, groups: [{ id: id(2), key: 'minister', name: 'وزراء', is_default: true }], candidates: [3, 4, 5, 6].map(n => ({ id: id(n), name: `مرشح ${n}`, title: null, imageUrl: null, originalUrl: null, candidate_group_id: id(2), category: 'minister' })), voteDay: '2026-11-14T00:00:00+01:00' };
test('TierList validates exact presentation contract and rejects unknown group assignments', () => {
  const data = decodeTierPage(page); expect(data.voteDay).toBe(page.voteDay); expect(data.candidates).toHaveLength(4);
  expect(() => decodeTierPage({ ...page, candidates: [{ ...page.candidates[0], id: '../evil' }] })).toThrow();
  expect(() => decodeTierPage({ ...page, candidates: [{ ...page.candidates[0], candidate_group_id: id(999) }] })).toThrow();
  expect(() => decodeTierPage({ ...page, candidates: [page.candidates[0], page.candidates[0]] })).toThrow();
  expect(() => decodeTierPage({ ...page, candidates: [{ ...page.candidates[0], imageUrl: 'javascript:bad' }] })).toThrow();
});
test('deterministic shuffle preserves source pool and poll/day seed', () => {
  const values = Array.from({ length: 30 }, (_, index) => index);
  expect(shuffled(values, 'poll|day')).toEqual(shuffled(values, 'poll|day'));
  expect(shuffled(values, 'poll|day')).not.toEqual(shuffled(values, 'poll|nextday'));
  expect([...shuffled(values, 'poll|day')].sort((a, b) => a - b)).toEqual(values);
});
test('multi-select move keeps unique ownership, source tier order and bank return', () => {
  const data = decodeTierPage(page); let state = initialBoard(data, id(2));
  state = moveCandidates(state, [id(3), id(4)], 'S');
  state = moveCandidates(state, [id(4), id(5)], 'A');
  expect(state.tiers.S).toEqual([id(3)]); expect(state.tiers.A).toEqual([id(4), id(5)]);
  state = moveCandidates(state, [id(3), id(5)], 'bank');
  expect(state.tiers.S).toHaveLength(0); expect(state.tiers.A).toEqual([id(4)]);
  expect(new Set([...state.bank, ...Object.values(state.tiers).flat()]).size).toBe(4);
  expect(() => moveCandidates(state, [id(888)], 'S')).toThrow();
  expect(initialBoard(data, id(2)).tiers.A).toEqual([]);
});
test('ballot minimum and exact candidate positions match server contract', () => {
  const data = decodeTierPage(page); let state = initialBoard(data, id(2));
  expect(() => ballot(data, state, 'device-fixture')).toThrow();
  state = moveCandidates(state, [id(3), id(4), id(5)], 'S');
  const payload = ballot(data, state, 'device-fixture');
  expect(payload.pollSlug).toBe('best-ministers'); expect(payload.deviceId).toBe('device-fixture');
  expect(payload.tiers.S).toEqual([id(3), id(4), id(5)].map((candidateId, pos) => ({ candidateId, pos })));
});
test('history chart cumulative aggregation takes period final value rather than summing running totals', () => {
  const history = { a: [{ date: '2026-11-02', votes: 2, score: 8 }, { date: '2026-11-03', votes: 3, score: 9 }, { date: '2026-11-09', votes: 1, score: 2 }] };
  const cumulative = seriesData(history, ['a'], 'score', 'week', 'cumulative');
  expect(cumulative.map(row => row.values.a)).toEqual([17, 19]);
  expect(seriesData(history, ['a'], 'votes', 'week', 'periodic').map(row => row.values.a)).toEqual([5, 1]);
  expect(seriesData(history, ['a'], 'score', 'month', 'periodic').map(row => row.values.a)).toEqual([19]);
  expect(seriesData(history, ['a'], 'votes', 'day', 'cumulative').map(row => row.values.a)).toEqual([2, 5, 6]);
});

test('leaderboard accepts actual SQL day labels, combines same-day rows without losing totals and respects numeric inactive polls', async () => {
  const { decodeLeaderboard } = await import('./model');
  const ranking = { candidateId: id(3), name: 'مرشح اختباري', title: null, imageUrl: null, rank: 1, score: 9, votes: 5, avg: 1.8 };
  const decoded = decodeLeaderboard({ poll: { ...page.poll, is_active: 0 }, groups: [{ ...page.groups[0], rankingKey: 'ministers' }], ministers: [ranking], history: { [id(3)]: [{ date: '2026-11-02 19:00:00', votes: 2, score: 4 }, { date: '2026-11-02 20:00:00', votes: 3, score: 5 }] } });
  expect(decoded.poll.active).toBe(false);
  expect(decoded.history[id(3)]).toEqual([{ date: '2026-11-02', votes: 5, score: 9 }]);
  expect(() => decodeLeaderboard({ poll: page.poll, groups: [], history: { [id(3)]: [{ date: '2026-11-02 28:00:00', votes: 2, score: 4 }] } })).toThrow();
});


test('ballot cooldown persists through the document contract with separate poll and day scopes', async () => {
  const values = new Map<string, string>();
  const store = createDocumentStore({ getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); } });
  const decode = (value: unknown): number => { if (typeof value !== 'number') throw new Error('Invalid cooldown'); return value; };
  const first = pollCooldownKey(id(1), page.voteDay);
  expect(await store.read(first, decode, 0)).toBe(0);
  await store.write(first, 2000000000000);
  expect(await store.read(first, decode, 0)).toBe(2000000000000);
  expect(await store.read(pollCooldownKey(id(2), page.voteDay), decode, 0)).toBe(0);
  expect(await store.read(pollCooldownKey(id(1), '2026-11-15T00:00:00+01:00'), decode, 0)).toBe(0);
});
