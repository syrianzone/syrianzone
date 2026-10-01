// A plain trick-taking round with no trump, where the point is to collect as
// little as possible — Hearts, Barbu, and the four avoidance contracts of Trix
// all reduce to this. The winner of a trick leads the next, and the cards each
// seat has won are kept so a contract can score them however it likes.
//
// Pure values in and out, like the rest of the kit.

import type { Card, Suit } from '../cards';
import { legalPlays as followSuit, nextSeat, trickWinner, type Play, type Seat } from './trick';

export interface CompletedTrick {
  plays: Play[];
  winner: Seat;
}

export interface AvoidanceRound {
  players: number;
  hands: Card[][];
  leader: Seat;
  turn: Seat;
  /** The trick in progress, in play order. */
  trick: Play[];
  history: CompletedTrick[];
  /** Every card each seat has taken, so a contract can count what it cares about. */
  collected: Card[][];
}

export function createAvoidanceRound(hands: Card[][], leader: Seat): AvoidanceRound {
  const players = hands.length;
  return {
    players,
    hands,
    leader,
    turn: leader,
    trick: [],
    history: [],
    collected: hands.map(() => []),
  };
}

/**
 * The cards a seat may play. `noLead` forbids opening a trick with that suit
 * (hearts in شيخ الكبة), unless it is all the seat holds.
 */
export function legalPlays(round: AvoidanceRound, seat: Seat, noLead?: Suit): Card[] {
  const hand = round.hands[seat];
  if (round.trick.length === 0) {
    if (noLead && hand.some((card) => card.suit !== noLead)) {
      return hand.filter((card) => card.suit !== noLead);
    }
    return hand;
  }
  return followSuit(hand, round.trick[0].card.suit, true);
}

export function playCard(round: AvoidanceRound, seat: Seat, card: Card, noLead?: Suit): AvoidanceRound {
  if (seat !== round.turn) throw new Error(`seat ${seat} is not on turn`);
  if (!legalPlays(round, seat, noLead).some((c) => c.id === card.id)) {
    throw new Error(`illegal play ${card.id}`);
  }

  const hands = round.hands.map((hand, i) => (i === seat ? hand.filter((c) => c.id !== card.id) : hand));
  const trick = [...round.trick, { seat, card }];

  if (trick.length < round.players) {
    return { ...round, hands, trick, turn: nextSeat(seat, round.players) };
  }

  const winner = trickWinner(trick, null).seat;
  const collected = round.collected.map((cards, i) =>
    i === winner ? [...cards, ...trick.map((play) => play.card)] : cards,
  );
  return {
    ...round,
    hands,
    trick: [],
    collected,
    history: [...round.history, { plays: trick, winner }],
    leader: winner,
    turn: winner,
  };
}

export function isComplete(round: AvoidanceRound): boolean {
  return round.hands.every((hand) => hand.length === 0);
}

/** Tricks won, per seat. */
export function tricksWon(round: AvoidanceRound): number[] {
  const counts = round.hands.map(() => 0);
  for (const trick of round.history) counts[trick.winner] += 1;
  return counts;
}
