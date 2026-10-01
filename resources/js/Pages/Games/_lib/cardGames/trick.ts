// Trick-taking primitives, shared by every game where players take turns
// playing one card to a trick and the highest card wins it. This is the part
// that is the same whether the game is tarneeb, trix, baloot or hearts; the
// rules that differ (how many tricks, who leads, what the trump is, how the
// result scores) sit on top, in each game's own module.
//
// Everything here is a pure function of plain values, so it can be unit-tested
// without a table and reused by a future online engine.

import type { Card, Suit } from '../cards';
import { power } from './hand';

export type Seat = number;

/** A card played to the current trick, in the order it was played. */
export interface Play {
  seat: Seat;
  card: Card;
}

/** Seats in turn order, starting from `leader`. */
export function playOrder(leader: Seat, players: number): Seat[] {
  return Array.from({ length: players }, (_, i) => (leader + i) % players);
}

export function nextSeat(seat: Seat, players: number): Seat {
  return (seat + 1) % players;
}

/** The suit that was led — the first card played to the trick, or null if none yet. */
export function ledSuit(plays: Play[]): Suit | null {
  return plays.length > 0 ? plays[0].card.suit : null;
}

/** Whether `hand` holds at least one card of `suit`. */
export function hasSuit(hand: Card[], suit: Suit): boolean {
  return hand.some((c) => c.suit === suit);
}

/**
 * The cards a seat may legally play. Leading a trick, or a game without the
 * follow-suit rule, leaves every card legal; otherwise a seat that holds the
 * led suit must play from it, and one that does not is free to play anything.
 */
export function legalPlays(hand: Card[], led: Suit | null, mustFollowSuit: boolean): Card[] {
  if (led === null || !mustFollowSuit || !hasSuit(hand, led)) return hand;
  return hand.filter((c) => c.suit === led);
}

/**
 * Whether `challenger` beats `incumbent`, given the suit that was led and the
 * round's trump (`null` for a no-trump round). A trump beats any plain card;
 * among trumps, and among plain cards of the led suit, the higher rank wins; a
 * plain card of another suit can never win.
 */
export function beats(challenger: Card, incumbent: Card, led: Suit, trump: Suit | null): boolean {
  const challengerTrumps = trump !== null && challenger.suit === trump;
  const incumbentTrumps = trump !== null && incumbent.suit === trump;
  if (challengerTrumps !== incumbentTrumps) return challengerTrumps;
  // Compare by playing power, not the stored rank: the ace is rank 1 but the
  // highest card.
  if (challengerTrumps) return power(challenger) > power(incumbent);
  if (challenger.suit === led && incumbent.suit === led) return power(challenger) > power(incumbent);
  return challenger.suit === led;
}

/** The winning play of a completed trick. */
export function trickWinner(plays: Play[], trump: Suit | null): Play {
  if (plays.length === 0) throw new Error('a trick needs at least one card');
  const led = plays[0].card.suit;
  return plays.reduce((best, play) => (beats(play.card, best.card, led, trump) ? play : best));
}
