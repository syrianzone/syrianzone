import { expect, test } from 'bun:test';
import { decodeGameRecords, recordBest, recordFinishedMatch, cardPips, sortHand } from './model';
import type { Card } from './engines';

test('preserves a best score and a shortest time in the separate source record stores', () => {
  const records = decodeGameRecords(null);
  const scored = recordBest(records, '2048', 100);
  expect(recordBest(scored, '2048', 40).best2048).toBe(100);
  const timed = recordBest(records, 'solitare', 90);
  expect(recordBest(timed, 'solitare', 100).bestSolitaireSeconds).toBe(90);
  expect(recordBest(timed, 'solitare', 60).bestSolitaireSeconds).toBe(60);
});
test('keeps finished match statistics separate from unfinished game state', () => {
  const records = recordFinishedMatch(decodeGameRecords(null), 'tarneeb', 'win');
  expect(records.tarneeb).toEqual({ played: 1, wins: 1, losses: 0, draws: 0 });
  expect(records.trix.played).toBe(0);
  expect(() => decodeGameRecords({ ...records, tarneeb: { played: 1, wins: 4, losses: 0, draws: 0 } })).toThrow();
});
test('uses the original pip counts and flips only the lower half', () => {
  expect(cardPips(10)).toHaveLength(10);
  expect(cardPips(7)).toHaveLength(7);
  expect(cardPips(1)).toEqual([{ x: 50, y: 50, flip: false }]);
  expect(cardPips(10).filter(p => p.flip).every(p => p.y > 50)).toBe(true);
});
test('Tarneeb and Trix preserve their different source hand ordering without changing engine hands', () => {
  const hand: Card[] = [{ id: 'H2', rank: 2, suit: 'H', faceUp: true }, { id: 'S4', rank: 4, suit: 'S', faceUp: true }, { id: 'S1', rank: 1, suit: 'S', faceUp: true }, { id: 'S13', rank: 13, suit: 'S', faceUp: true }];
  expect(sortHand(hand, 'tarneeb').map(card => card.id)).toEqual(['S1', 'S13', 'S4', 'H2']);
  expect(sortHand(hand, 'trix').map(card => card.id)).toEqual(['S4', 'S13', 'S1', 'H2']);
  expect(hand.map(card => card.id)).toEqual(['H2', 'S4', 'S1', 'S13']);
});

test('serializes record updates and preserves a valid record after a disk failure', async () => {
  const { createGameRecordStore } = await import('./model');
  let stored = decodeGameRecords(null);
  let fail = false;
  const store = createGameRecordStore(async () => stored, async value => { if (fail) throw new Error('disk full'); stored = value; });
  await Promise.all([store.change(value => recordBest(value, '2048', 80)), store.change(value => recordBest(value, '2048', 100))]);
  expect((await store.load()).best2048).toBe(100);
  fail = true;
  await expect(store.change(value => recordBest(value, '2048', 120))).rejects.toThrow('disk full');
  expect((await store.load()).best2048).toBe(100);
  fail = false;
  await store.change(value => recordBest(value, '2048', 140));
  expect(stored.best2048).toBe(140);
});
test('an initial read failure does not permanently poison later game record reads or writes', async () => {
  const { createGameRecordStore } = await import('./model');
  let available = false, stored = decodeGameRecords(null);
  const store = createGameRecordStore(async () => { if (!available) throw new Error('device locked'); return stored; }, async value => { stored = value; });
  await expect(store.change(value => recordBest(value, '2048', 100))).rejects.toThrow('device locked');
  available = true;
  expect((await store.load()).best2048).toBe(0);
  await store.change(value => recordBest(value, '2048', 120));
  expect((await store.load()).best2048).toBe(120);
});
