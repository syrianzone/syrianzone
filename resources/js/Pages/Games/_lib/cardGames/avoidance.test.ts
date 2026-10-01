import { describe, expect, it } from 'vitest';
import type { Card, Suit } from '../cards';
import { createAvoidanceRound, isComplete, legalPlays, playCard, tricksWon } from './avoidance';

const card = (rank: number, suit: Suit): Card => ({ id: `${suit}${rank}`, rank, suit, faceUp: true });
const board = (hands: Card[][], leader = 0) => createAvoidanceRound(hands, leader);

describe('avoidance round', () => {
  it('forces the led suit when it can be followed', () => {
    const round = board([[card(5, 'H')], [card(9, 'H'), card(2, 'S')]], 0);
    const afterLead = playCard(round, 0, card(5, 'H'));
    expect(legalPlays(afterLead, 1).map((c) => c.id)).toEqual(['H9']);
  });

  it('frees a seat that cannot follow', () => {
    const round = playCard(board([[card(5, 'H')], [card(2, 'S')]], 0), 0, card(5, 'H'));
    expect(legalPlays(round, 1).map((c) => c.id)).toEqual(['S2']);
  });

  it('awards the trick and its cards to the highest of the led suit', () => {
    let round = board([[card(5, 'H')], [card(9, 'H')], [card(13, 'S')]], 0);
    round = playCard(round, 0, card(5, 'H'));
    round = playCard(round, 1, card(9, 'H'));
    round = playCard(round, 2, card(13, 'S')); // off-suit plain can't win
    expect(round.history[0].winner).toBe(1);
    expect(round.collected[1].map((c) => c.id)).toEqual(['H5', 'H9', 'S13']);
    expect(round.collected[0]).toEqual([]);
    expect(round.turn).toBe(1);
  });

  it('forbids leading the off-limits suit unless it is all you hold', () => {
    const round = board([[card(2, 'H'), card(4, 'S')], [], []], 0);
    expect(legalPlays(round, 0, 'H').map((c) => c.id)).toEqual(['S4']);

    const only = board([[card(2, 'H'), card(5, 'H')], [], []], 0);
    expect(legalPlays(only, 0, 'H').map((c) => c.id)).toEqual(['H2', 'H5']);
  });

  it('counts tricks and knows when the round is over', () => {
    let round = board([[card(5, 'H')], [card(9, 'H')]], 0);
    round = playCard(round, 0, card(5, 'H'));
    round = playCard(round, 1, card(9, 'H'));
    expect(tricksWon(round)).toEqual([0, 1]);
    expect(isComplete(round)).toBe(true);
  });
});
