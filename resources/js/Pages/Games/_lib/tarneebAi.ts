// A tarneeb opponent. Not a search engine — a readable set of table heuristics:
// bid on the tricks the hand can plausibly take, keep the shortest-read trump,
// and play to win the trick cheaply without robbing partner.
//
// The policy is pure: given a round it returns an action and nothing else, so
// the same functions run a single opponent or all four seats in a simulation.
// The generic reads (power, grouping, top sequences) come from cardGames/hand.

import { SUITS, type Card, type Suit } from './cards';
import { groupBySuit, lowest, power, topSequence } from './cardGames/hand';
import { beats, trickWinner, type Seat } from './cardGames/trick';
import { TARNEEB_HAND, TARNEEB_PLAYERS, legalBids, legalPlays, type TarneebRound } from './tarneeb';

/**
 * The tricks a hand can plausibly take with `trump`: every trump counts (long
 * trumps win tricks), and in the other suits only the run from the ace is sure.
 * It over-counts a little on purpose — an opponent that bids its sure tricks
 * would never reach the table's minimum.
 */
export function estimateTricks(hand: Card[], trump: Suit): number {
  const bySuit = groupBySuit(hand);
  let tricks = 0;
  for (const suit of SUITS) {
    tricks += suit === trump ? bySuit[suit].length : topSequence(bySuit[suit]);
  }
  return Math.min(TARNEEB_HAND, tricks);
}

/** The trump the hand most wants, and the tricks it expects to take with it. */
export function bestTrump(hand: Card[]): { trump: Suit; tricks: number } {
  let best: { trump: Suit; tricks: number } | null = null;
  for (const trump of SUITS) {
    const tricks = estimateTricks(hand, trump);
    // A higher estimate wins; on a tie the longer suit is the better trump.
    if (
      best === null ||
      tricks > best.tricks ||
      (tricks === best.tricks && byLength(hand, trump) > byLength(hand, best.trump))
    ) {
      best = { trump, tricks };
    }
  }
  return best!;
}

function byLength(hand: Card[], suit: Suit): number {
  return hand.filter((card) => card.suit === suit).length;
}

/** A bid for the seat on turn, or null to pass. */
export function chooseBid(round: TarneebRound, seat: Seat): number | null {
  const allowed = legalBids(round);
  if (allowed.length === 0) return null;
  const { tricks } = bestTrump(round.hands[seat]);
  const value = Math.min(round.options.maxBid, tricks);
  return value >= allowed[0] ? value : null;
}

/** The trump the declarer should name. */
export function chooseTrump(round: TarneebRound, seat: Seat): Suit {
  return bestTrump(round.hands[seat]).trump;
}

/** The card the seat on turn should play. */
export function choosePlay(round: TarneebRound, seat: Seat): Card {
  const legal = legalPlays(round, seat);
  if (legal.length === 0) throw new Error(`seat ${seat} has no legal play`);
  if (legal.length === 1) return legal[0];

  const trump = round.trump;

  if (round.trick.length === 0) return lead(legal, trump);

  const led = round.trick[0].card.suit;
  const current = trickWinner(round.trick, trump);
  const partner = (seat + 2) % TARNEEB_PLAYERS;
  const partnerSafe = current.seat === partner && (current.card.suit === trump || power(current.card) >= 12);
  if (partnerSafe) return lowest(legal);

  // Win the trick with the cheapest card that beats what is on the table; if
  // nothing beats it, throw the lowest card away.
  const winning = legal.filter((card) => beats(card, current.card, led, trump));
  return winning.length > 0 ? lowest(winning) : lowest(legal);
}

/** Lead an ace in a side suit if there is one to cash, otherwise the lowest card. */
function lead(legal: Card[], trump: Suit | null): Card {
  const aces = legal.filter((card) => card.rank === 1 && card.suit !== trump);
  if (aces.length > 0) return aces[0];
  const plain = legal.filter((card) => card.suit !== trump);
  return lowest(plain.length > 0 ? plain : legal);
}
