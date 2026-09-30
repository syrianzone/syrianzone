import { describe, expect, it } from 'vitest';
import type { Card, Suit } from '../cards';
import { groupBySuit, highest, lowest, power, topSequence } from './hand';

const card = (rank: number, suit: Suit): Card => ({ id: `${suit}${rank}`, rank, suit, faceUp: true });

describe('power', () => {
  it('ranks the ace high, above the king', () => {
    expect(power(card(1, 'S'))).toBe(14);
    expect(power(card(13, 'S'))).toBe(13);
    expect(power(card(2, 'S'))).toBe(2);
    expect(power(card(1, 'S'))).toBeGreaterThan(power(card(13, 'S')));
  });
});

describe('groupBySuit', () => {
  it('keeps every suit, empty ones included', () => {
    const groups = groupBySuit([card(5, 'H'), card(9, 'H'), card(2, 'S')]);
    expect(groups.H.map((c) => c.rank)).toEqual([5, 9]);
    expect(groups.S).toHaveLength(1);
    expect(groups.D).toEqual([]);
    expect(groups.C).toEqual([]);
  });
});

describe('lowest and highest', () => {
  it('compare by power, not by the stored rank', () => {
    const cards = [card(1, 'S'), card(13, 'S'), card(7, 'S')];
    expect(lowest(cards).rank).toBe(7);
    expect(highest(cards).rank).toBe(1); // the ace
  });

  it('refuses an empty hand', () => {
    expect(() => lowest([])).toThrow();
  });
});

describe('topSequence', () => {
  it('counts the run from the ace', () => {
    expect(topSequence([card(1, 'S')])).toBe(1);
    expect(topSequence([card(1, 'S'), card(13, 'S')])).toBe(2);
    expect(topSequence([card(1, 'S'), card(13, 'S'), card(12, 'S')])).toBe(3);
  });

  it('is broken by a missing card', () => {
    // K Q J without the ace is no sure trick.
    expect(topSequence([card(13, 'S'), card(12, 'S'), card(11, 'S')])).toBe(0);
    // A K Q J, then a gap at the ten.
    expect(topSequence([card(1, 'S'), card(13, 'S'), card(12, 'S'), card(11, 'S'), card(9, 'S')])).toBe(4);
  });
});
