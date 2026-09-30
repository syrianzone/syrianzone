// Small hand-evaluation helpers shared by card-game AIs. They know nothing
// about a particular game — only how to read a hand — so a bidding or playing
// policy for tarneeb, trix or anything else can build on the same primitives.

import { SUITS, type Card, type Suit } from '../cards';

/**
 * A card's playing power — ace high, so 14, king 13 … and the 2 is 2. Ranks are
 * stored ace-low (1), which makes arithmetic comparisons lie, so anything that
 * ranks cards goes through this.
 */
export const power = (card: Card): number => (card.rank === 1 ? 14 : card.rank);

/** Cards grouped by suit, with every suit present even when empty. */
export function groupBySuit(cards: Card[]): Record<Suit, Card[]> {
  const groups = Object.fromEntries(SUITS.map((suit) => [suit, [] as Card[]])) as Record<Suit, Card[]>;
  for (const card of cards) groups[card.suit].push(card);
  return groups;
}

export function lowest(cards: Card[]): Card {
  if (cards.length === 0) throw new Error('no cards to choose from');
  return cards.reduce((low, card) => (power(card) < power(low) ? card : low));
}

export function highest(cards: Card[]): Card {
  if (cards.length === 0) throw new Error('no cards to choose from');
  return cards.reduce((high, card) => (power(card) > power(high) ? card : high));
}

/**
 * How many sure tricks sit at the top of a suit: the run from the ace, so A,
 * AK, AKQ, … A missing ace breaks the run, since the king may not be a winner.
 */
export function topSequence(cards: Card[]): number {
  const ranks = new Set(cards.map(power));
  let wanted = 14;
  let run = 0;
  while (ranks.has(wanted)) {
    run += 1;
    wanted -= 1;
  }
  return run;
}
