// A domino / sevens layout: each suit grows outwards from a pivot rank, one
// card at a time. Trix's positive contract uses it with the Jack as the pivot;
// Fan Tan and Sevens use the seven. Ranks are compared by playing power, since
// the ace is stored as rank 1 but sits above the king.

import type { Card, Suit } from '../cards';
import { power } from './hand';

export interface ShedRun {
  /** Lowest and highest power laid down in this suit, inclusive. */
  lo: number;
  hi: number;
}

export interface ShedLayout {
  runs: Partial<Record<Suit, ShedRun>>;
  /** The powers laid per suit, in the order they were played. */
  laid: Partial<Record<Suit, number[]>>;
}

export function emptyLayout(): ShedLayout {
  return { runs: {}, laid: {} };
}

/** A card may open a suit only at the pivot, or extend an open run by one. */
export function canPlay(layout: ShedLayout, card: Card, pivot: number): boolean {
  const p = power(card);
  const run = layout.runs[card.suit];
  if (!run) return p === pivot;
  return p === run.hi + 1 || p === run.lo - 1;
}

export function lay(layout: ShedLayout, card: Card, pivot: number): ShedLayout {
  if (!canPlay(layout, card, pivot)) throw new Error(`illegal lay ${card.id}`);
  const p = power(card);
  const run = layout.runs[card.suit];
  const next: ShedRun = run ? { lo: Math.min(run.lo, p), hi: Math.max(run.hi, p) } : { lo: p, hi: p };
  return {
    runs: { ...layout.runs, [card.suit]: next },
    laid: { ...layout.laid, [card.suit]: [...(layout.laid[card.suit] ?? []), p] },
  };
}

/** The cards in a hand that the layout will accept right now. */
export function legalCards(layout: ShedLayout, hand: Card[], pivot: number): Card[] {
  return hand.filter((card) => canPlay(layout, card, pivot));
}
