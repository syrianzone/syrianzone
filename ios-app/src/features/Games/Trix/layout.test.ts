import { expect, test } from 'bun:test';
import { sheddingColumns } from './layout';

test('Trix cards retain Ace-to-two slots instead of following play order', () => {
  const laid = { S: [11, 14, 10, 12] };
  const before = JSON.stringify(laid);
  const columns = sheddingColumns(laid);
  expect(columns.map(column => column.suit)).toEqual(['S', 'H', 'D', 'C']);
  expect(columns[0]?.cards.map(slot => [slot.index, slot.card.rank])).toEqual([[0, 1], [2, 12], [3, 11], [4, 10]]);
  expect(columns.slice(1).every(column => column.cards.length === 0)).toBe(true);
  expect(JSON.stringify(laid)).toBe(before);
});

test('a completed Trix layout represents every card once in its reserved slot', () => {
  const powers = Array.from({ length: 13 }, (_, index) => index + 2);
  const columns = sheddingColumns({ S: powers, H: powers, D: powers, C: powers });
  const slots = columns.flatMap(column => column.cards);
  expect(slots).toHaveLength(52);
  expect(new Set(slots.map(slot => slot.card.id)).size).toBe(52);
  expect(columns.every(column => column.cards.map(slot => slot.index).join(',') === '0,1,2,3,4,5,6,7,8,9,10,11,12')).toBe(true);
  expect(slots.every(slot => slot.card.faceUp)).toBe(true);
});
