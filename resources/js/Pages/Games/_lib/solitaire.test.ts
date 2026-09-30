import { describe, expect, it } from 'vitest';
import type { Card, Suit } from './cards';
import { applyMove, canMove, createDeal, drawStock, liftable, type Deal } from './solitaire';

const card = (rank: number, suit: Suit, faceUp = true): Card => ({
  id: `${suit}${rank}`,
  rank,
  suit,
  faceUp,
});

/** A board with only the given tableau columns, each of `card`s. */
const board = (tableau: Card[][]): Deal => ({
  stock: [],
  waste: [],
  foundations: [[], [], [], []],
  tableau: [...tableau, ...Array.from({ length: 7 - tableau.length }, () => [] as Card[])],
});

describe('createDeal', () => {
  it('deals columns of 1..7 cards, one face up each, and a 24-card stock', () => {
    const deal = createDeal(() => 0.42);
    expect(deal.tableau.map((c) => c.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(deal.tableau.map((c) => c.filter((x) => x.faceUp).length)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(deal.stock).toHaveLength(24);
    expect(deal.stock.every((c) => !c.faceUp)).toBe(true);
    expect(deal.waste).toHaveLength(0);
  });
});

describe('liftable', () => {
  it('lifts a whole face-up run but never a face-down card', () => {
    const deal = board([[card(13, 'S', false), card(12, 'H'), card(11, 'S')]]);
    expect(liftable(deal, { kind: 'tableau', column: 0, cardIndex: 1 })?.map((c) => c.rank)).toEqual([12, 11]);
    expect(liftable(deal, { kind: 'tableau', column: 0, cardIndex: 0 })).toBeNull();
  });
});

describe('tableau moves', () => {
  it('stacks descending and alternating, and flips the card it uncovers', () => {
    const deal = board([[card(4, 'S', false), card(5, 'H')], [card(6, 'C')]]);
    const from = { kind: 'tableau', column: 0, cardIndex: 1 } as const;
    const to = { kind: 'tableau', column: 1 } as const;
    expect(canMove(deal, from, to)).toBe(true);
    const next = applyMove(deal, from, to);
    expect(next.tableau[0]).toHaveLength(1);
    expect(next.tableau[0][0].faceUp).toBe(true); // 4S was uncovered
    expect(next.tableau[1].map((c) => c.rank)).toEqual([6, 5]);
  });

  it('only lets a king start an empty column', () => {
    const king = board([[card(13, 'S')]]);
    expect(canMove(king, { kind: 'tableau', column: 0, cardIndex: 0 }, { kind: 'tableau', column: 1 })).toBe(true);
    const five = board([[card(5, 'S')]]);
    expect(canMove(five, { kind: 'tableau', column: 0, cardIndex: 0 }, { kind: 'tableau', column: 1 })).toBe(false);
  });
});

describe('foundations', () => {
  it('builds up by suit, ace first', () => {
    const deal = board([]);
    deal.waste = [card(3, 'S')];
    expect(canMove(deal, { kind: 'waste' }, { kind: 'foundation', index: 0 })).toBe(false); // no 2 yet
    deal.foundations[0] = [card(1, 'S'), card(2, 'S')];
    expect(canMove(deal, { kind: 'waste' }, { kind: 'foundation', index: 0 })).toBe(true);
    expect(canMove(deal, { kind: 'waste' }, { kind: 'foundation', index: 1 })).toBe(false);
  });
});

describe('drawStock', () => {
  it('draws the top stock card face up, then recycles the waste', () => {
    const deal = board([]);
    deal.stock = [card(1, 'S', false), card(2, 'H', false)];
    const drawn = drawStock(deal);
    expect(drawn.waste.map((c) => c.rank)).toEqual([2]);
    expect(drawn.waste[0].faceUp).toBe(true);
    expect(drawn.stock.map((c) => c.rank)).toEqual([1]);

    const emptied = drawStock(drawn); // draws the 1, stock now empty
    const recycled = drawStock(emptied); // nothing to draw, so flip the waste back
    expect(recycled.stock.map((c) => c.rank)).toEqual([1, 2]);
    expect(recycled.stock.every((c) => !c.faceUp)).toBe(true);
    expect(recycled.waste).toHaveLength(0);
  });
});
