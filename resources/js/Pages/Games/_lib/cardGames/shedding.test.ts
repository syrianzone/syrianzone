import { describe, expect, it } from 'vitest';
import type { Card, Suit } from '../cards';
import { canPlay, emptyLayout, lay, legalCards } from './shedding';

const card = (rank: number, suit: Suit): Card => ({ id: `${suit}${rank}`, rank, suit, faceUp: true });
const JACK = 11;

describe('shedding layout', () => {
  it('opens a suit only at the pivot', () => {
    const layout = emptyLayout();
    expect(canPlay(layout, card(11, 'S'), JACK)).toBe(true); // jack
    expect(canPlay(layout, card(10, 'S'), JACK)).toBe(false);
    expect(canPlay(layout, card(12, 'S'), JACK)).toBe(false);
  });

  it('extends an open run one rank at a time, both ways', () => {
    let layout = lay(emptyLayout(), card(11, 'S'), JACK);
    expect(canPlay(layout, card(12, 'S'), JACK)).toBe(true); // queen up
    expect(canPlay(layout, card(10, 'S'), JACK)).toBe(true); // ten down
    expect(canPlay(layout, card(9, 'S'), JACK)).toBe(false); // not adjacent yet

    layout = lay(layout, card(10, 'S'), JACK);
    expect(canPlay(layout, card(9, 'S'), JACK)).toBe(true);
  });

  it('keeps the ace above the king', () => {
    let layout = emptyLayout();
    for (const rank of [11, 12, 13]) layout = lay(layout, card(rank, 'H'), JACK);
    expect(canPlay(layout, card(1, 'H'), JACK)).toBe(true); // ace closes the run upward
    layout = lay(layout, card(1, 'H'), JACK);
    expect(layout.runs.H).toEqual({ lo: 11, hi: 14 });
  });

  it('records the order the cards were laid', () => {
    let layout = emptyLayout();
    for (const rank of [11, 10, 9, 12]) layout = lay(layout, card(rank, 'S'), JACK);
    expect(layout.laid.S).toEqual([11, 10, 9, 12]);
  });

  it('will not lay an illegal card', () => {
    expect(() => lay(emptyLayout(), card(5, 'S'), JACK)).toThrow();
  });

  it('lists the legal cards in a hand', () => {
    const hand = [card(11, 'S'), card(10, 'D'), card(11, 'H')];
    expect(legalCards(emptyLayout(), hand, JACK).map((c) => c.id)).toEqual(['S11', 'H11']);
  });
});
