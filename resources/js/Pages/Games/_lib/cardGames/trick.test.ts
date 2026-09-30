import { describe, expect, it } from 'vitest';
import type { Card, Suit } from '../cards';
import {
  beats,
  hasSuit,
  ledSuit,
  legalPlays,
  nextSeat,
  playOrder,
  trickWinner,
  type Play,
} from './trick';

const card = (rank: number, suit: Suit): Card => ({ id: `${suit}${rank}`, rank, suit, faceUp: true });
const play = (seat: number, rank: number, suit: Suit): Play => ({ seat, card: card(rank, suit) });

describe('seat order', () => {
  it('wraps turn order from the leader', () => {
    expect(playOrder(2, 4)).toEqual([2, 3, 0, 1]);
    expect(nextSeat(3, 4)).toBe(0);
  });
});

describe('following suit', () => {
  const hand = [card(5, 'H'), card(9, 'H'), card(2, 'S')];

  it('knows which suits are held', () => {
    expect(hasSuit(hand, 'H')).toBe(true);
    expect(hasSuit(hand, 'D')).toBe(false);
  });

  it('allows any card when leading', () => {
    expect(legalPlays(hand, null, true)).toEqual(hand);
  });

  it('forces the led suit when it can be followed', () => {
    expect(legalPlays(hand, 'H', true).map((c) => c.rank)).toEqual([5, 9]);
  });

  it('frees a seat that cannot follow', () => {
    expect(legalPlays(hand, 'D', true)).toEqual(hand);
  });

  it('ignores the rule when the game has none', () => {
    expect(legalPlays(hand, 'H', false)).toEqual(hand);
  });
});

describe('beats', () => {
  it('lets a trump beat a plain card, and not the other way round', () => {
    expect(beats(card(2, 'S'), card(13, 'H'), 'H', 'S')).toBe(true);
    expect(beats(card(13, 'H'), card(2, 'S'), 'H', 'S')).toBe(false);
  });

  it('ranks two trumps by rank', () => {
    expect(beats(card(11, 'S'), card(10, 'S'), 'H', 'S')).toBe(true);
    expect(beats(card(10, 'S'), card(11, 'S'), 'H', 'S')).toBe(false);
  });

  it('ranks two cards of the led suit by rank', () => {
    expect(beats(card(11, 'H'), card(10, 'H'), 'H', null)).toBe(true);
  });

  it('never lets a plain off-suit card win', () => {
    expect(beats(card(13, 'C'), card(2, 'H'), 'H', null)).toBe(false);
    expect(beats(card(13, 'C'), card(2, 'H'), 'H', 'S')).toBe(false);
  });
});

describe('trickWinner', () => {
  it('takes the highest card of the led suit in a no-trump round', () => {
    const plays = [play(0, 5, 'H'), play(1, 9, 'H'), play(2, 13, 'S'), play(3, 8, 'H')];
    expect(trickWinner(plays, null).seat).toBe(1);
  });

  it('gives it to the highest trump when one was played', () => {
    const plays = [play(0, 5, 'H'), play(1, 13, 'H'), play(2, 2, 'S'), play(3, 8, 'H')];
    expect(trickWinner(plays, 'S').seat).toBe(2);
  });

  it('ranks trumps against each other', () => {
    const plays = [play(0, 5, 'H'), play(1, 2, 'S'), play(2, 4, 'S')];
    expect(trickWinner(plays, 'S').seat).toBe(2);
  });

  it('leaves the led suit in charge when no trump fell', () => {
    const plays = [play(0, 5, 'H'), play(1, 13, 'H'), play(2, 12, 'S')];
    expect(trickWinner(plays, 'D').seat).toBe(1);
  });
});
