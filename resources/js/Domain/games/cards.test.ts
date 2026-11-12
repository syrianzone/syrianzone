import { describe, expect, it } from 'vitest';
import {
  PIP_LAYOUTS,
  RANKS,
  RANK_LABEL,
  SUITS,
  SUIT_LABEL,
  createDeck,
  isCourt,
  isRed,
  shuffle,
  type Card,
} from './cards';

describe('createDeck', () => {
  it('is a full 52-card deck', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
    expect(deck.every((c) => c.rank >= 1 && c.rank <= RANKS)).toBe(true);
    expect(new Set(deck.map((c) => c.suit))).toEqual(new Set(SUITS));
  });

  it('deals cards face down', () => {
    expect(createDeck().every((c) => c.faceUp === false)).toBe(true);
  });
});

describe('shuffle', () => {
  it('keeps every card, and does not touch the input', () => {
    const deck = createDeck();
    const copy = deck.slice();
    const shuffled = shuffle(deck, () => 0.5);
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled.map((c) => c.id))).toEqual(new Set(deck.map((c) => c.id)));
    expect(deck).toEqual(copy);
  });

  it('is deterministic for a fixed source of randomness', () => {
    const random = () => 0.25;
    const a = shuffle(createDeck(), random).map((c) => c.id);
    const b = shuffle(createDeck(), random).map((c) => c.id);
    expect(a).toEqual(b);
  });
});

describe('labels and colours', () => {
  it('labels every rank and suit', () => {
    expect(RANK_LABEL[1]).toBe('A');
    expect(RANK_LABEL[11]).toBe('J');
    expect(RANK_LABEL[13]).toBe('K');
    expect(SUIT_LABEL).toEqual({ S: '♠', H: '♥', D: '♦', C: '♣' });
  });

  it('calls hearts and diamonds red', () => {
    const card = (suit: Card['suit']): Card => ({ id: `${suit}1`, rank: 1, suit, faceUp: true });
    expect(isRed(card('H'))).toBe(true);
    expect(isRed(card('D'))).toBe(true);
    expect(isRed(card('S'))).toBe(false);
    expect(isRed(card('C'))).toBe(false);
  });

  it('treats jack, queen and king as court cards', () => {
    expect(isCourt(10)).toBe(false);
    expect(isCourt(11)).toBe(true);
    expect(isCourt(13)).toBe(true);
  });
});

describe('pip layouts', () => {
  it('has the right number of pips for each number card', () => {
    for (let rank = 2; rank <= 10; rank++) {
      expect(PIP_LAYOUTS[rank], `rank ${rank}`).toHaveLength(rank);
    }
  });

  it('places every pip inside the card', () => {
    for (const layout of Object.values(PIP_LAYOUTS)) {
      for (const pip of layout) {
        expect(pip.x).toBeGreaterThanOrEqual(0);
        expect(pip.x).toBeLessThanOrEqual(100);
        expect(pip.y).toBeGreaterThanOrEqual(0);
        expect(pip.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it('mirrors everything below the middle line', () => {
    for (const layout of Object.values(PIP_LAYOUTS)) {
      for (const pip of layout) {
        expect(Boolean(pip.flip)).toBe(pip.y > 50);
      }
    }
  });

  it('gives the 9 a single centre pip and the 10 two', () => {
    const centre = (rank: number) => PIP_LAYOUTS[rank].filter((p) => p.x === 50);
    expect(centre(9)).toHaveLength(1);
    expect(centre(9)[0].y).toBe(50);
    expect(centre(10)).toHaveLength(2);
    // The outer field is shared, so the 9 and 10 differ only in the centre.
    const outer = (rank: number) => PIP_LAYOUTS[rank].filter((p) => p.x !== 50);
    expect(outer(9)).toEqual(outer(10));
    expect(outer(9)).toHaveLength(8);
  });
});
