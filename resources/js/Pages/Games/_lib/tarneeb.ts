// Tarneeb: four seats in two partnerships, an auction for the contract, a trump
// named by the declarer, then thirteen tricks. This is only the part that is
// specifically tarneeb — the deck, the follow-suit rule, the trump-aware trick
// winner, the auction and the match scaffolding all come from the shared kit.
//
// A round is a plain value and every transition returns a new one, so a table
// component can treat it like `Deal` in solitaire: history is an array of
// values, and the rules stay testable without a browser.
//
// CONVENTIONS. Tarneeb is played differently from table to table; the knobs are
// all in `TarneebOptions` and the scoring rule is a single exported function
// (`tarneebScore`) so it can be swapped. The defaults are the common Levantine
// game: bid 7–13, play to 41, the contract team scores the tricks it took when
// it makes the bid, the defenders score the bid when it fails, and kaboot (the
// whole hand) is scored as in `tarneebScore`. The doubles some tables allow are
// still not modelled.

import { createDeck, shuffle, type Card, type Suit } from './cards';
import {
  createAuction,
  currentSeat,
  legalBids as auctionBids,
  passAuction,
  placeBid,
  type Auction,
} from './cardGames/bidding';
import {
  legalPlays as followSuit,
  nextSeat,
  playOrder,
  trickWinner,
  type Play,
  type Seat,
} from './cardGames/trick';

export const TARNEEB_PLAYERS = 4;
/** Cards each seat is dealt, which is also the number of tricks in a round. */
export const TARNEEB_HAND = 13;
/** Partnerships: seats 0 and 2 against 1 and 3. */
export const TARNEEB_TEAMS: Seat[][] = [
  [0, 2],
  [1, 3],
];

export interface TarneebOptions {
  /** Points a team must reach to win the match. */
  target: number;
  /** Smallest legal bid. */
  minBid: number;
  /** Largest legal bid — the whole hand. */
  maxBid: number;
  /** The bid that means every trick (kaboot). */
  kaboot: number;
  /** Points for a made kaboot contract. */
  kabootMade: number;
  /** Points the declarer's team loses for a failed kaboot contract. */
  kabootLoss: number;
  /** The defenders score this many times their own tricks when a kaboot fails. */
  kabootDefence: number;
  /** Bonus for sweeping all thirteen tricks on a bid short of kaboot. */
  sweepBonus: number;
}

export const DEFAULT_TARNEEB: TarneebOptions = {
  target: 41,
  minBid: 7,
  maxBid: 13,
  kaboot: 13,
  kabootMade: 26,
  kabootLoss: 16,
  kabootDefence: 2,
  sweepBonus: 3,
};

export type Phase = 'bidding' | 'trump' | 'playing' | 'complete';

export interface CompletedTrick {
  plays: Play[];
  winner: Seat;
}

export interface TarneebRound {
  options: TarneebOptions;
  dealer: Seat;
  /** The four hands, by seat. */
  hands: Card[][];
  auction: Auction;
  phase: Phase;
  trump: Suit | null;
  declarer: Seat | null;
  /** Whose turn it is, or null once the round is complete. */
  turn: Seat | null;
  /** The trick in progress, in play order. */
  trick: Play[];
  /** Tricks won so far, per team. */
  tricks: [number, number];
  history: CompletedTrick[];
}

/** The team a seat plays for. */
export const teamOf = (seat: Seat): 0 | 1 => (seat % 2 === 0 ? 0 : 1);

export function createRound(
  options: TarneebOptions = DEFAULT_TARNEEB,
  dealer: Seat = 0,
  random: () => number = Math.random,
): TarneebRound {
  const deck = shuffle(createDeck(), random).map((card) => ({ ...card, faceUp: true }));
  const hands = Array.from({ length: TARNEEB_PLAYERS }, (_, seat) =>
    deck.slice(seat * TARNEEB_HAND, seat * TARNEEB_HAND + TARNEEB_HAND),
  );
  // Bidding opens to the dealer's left.
  const order = playOrder(nextSeat(dealer, TARNEEB_PLAYERS), TARNEEB_PLAYERS);
  const auction = createAuction({ order, min: options.minBid, max: options.maxBid });
  return {
    options,
    dealer,
    hands,
    auction,
    phase: 'bidding',
    trump: null,
    declarer: null,
    turn: currentSeat(auction),
    trick: [],
    tricks: [0, 0],
    history: [],
  };
}

/** The bids the seat on turn may make; empty outside the auction. */
export function legalBids(round: TarneebRound): number[] {
  return round.phase === 'bidding' ? auctionBids(round.auction) : [];
}

function afterAuction(round: TarneebRound, auction: Auction): TarneebRound {
  if (!auction.complete) {
    return { ...round, auction, turn: currentSeat(auction) };
  }
  if (auction.declarer === null) {
    // Everyone passed: the table redeals rather than anyone scoring.
    return { ...round, auction, phase: 'complete', turn: null };
  }
  // The declarer now names trump.
  return { ...round, auction, phase: 'trump', declarer: auction.declarer, turn: auction.declarer };
}

export function bid(round: TarneebRound, seat: Seat, value: number): TarneebRound {
  if (round.phase !== 'bidding') throw new Error('not in the auction');
  return afterAuction(round, placeBid(round.auction, seat, value));
}

export function pass(round: TarneebRound, seat: Seat): TarneebRound {
  if (round.phase !== 'bidding') throw new Error('not in the auction');
  return afterAuction(round, passAuction(round.auction, seat));
}

/** The declarer names the trump suit and leads the first trick. */
export function chooseTrump(round: TarneebRound, seat: Seat, suit: Suit): TarneebRound {
  if (round.phase !== 'trump') throw new Error('the trump is not being chosen');
  if (seat !== round.declarer) throw new Error('only the declarer names trump');
  return { ...round, phase: 'playing', trump: suit, turn: round.declarer, declarer: round.declarer };
}

/** The cards the seat on turn may play — the shared follow-suit rule. */
export function legalPlays(round: TarneebRound, seat: Seat): Card[] {
  if (round.phase !== 'playing') return [];
  if (seat !== round.turn) return [];
  return followSuit(round.hands[seat], round.trick.length > 0 ? round.trick[0].card.suit : null, true);
}

export function playCard(round: TarneebRound, seat: Seat, card: Card): TarneebRound {
  if (round.phase !== 'playing') throw new Error('not in the playing phase');
  if (seat !== round.turn) throw new Error(`seat ${seat} is not on turn`);
  if (!legalPlays(round, seat).some((c) => c.id === card.id)) throw new Error(`illegal play ${card.id}`);

  const hands = round.hands.map((hand, i) => (i === seat ? hand.filter((c) => c.id !== card.id) : hand));
  const trick = [...round.trick, { seat, card }];

  if (trick.length < TARNEEB_PLAYERS) {
    return { ...round, hands, trick, turn: nextSeat(seat, TARNEEB_PLAYERS) };
  }

  // Fourth card: the trick is decided and its winner leads the next.
  const winner = trickWinner(trick, round.trump).seat;
  const tricks: [number, number] = [...round.tricks];
  tricks[teamOf(winner)] += 1;
  const complete = hands.every((hand) => hand.length === 0);
  return {
    ...round,
    hands,
    trick: [],
    tricks,
    history: [...round.history, { plays: trick, winner }],
    phase: complete ? 'complete' : 'playing',
    turn: complete ? null : winner,
  };
}

/** True when the auction passed out and the deal must be thrown in. */
export function isRedeal(round: TarneebRound): boolean {
  return round.phase === 'complete' && round.declarer === null;
}

/**
 * Points per team for a finished contract: the contract team scores the tricks
 * it took when it reached the bid, and the defenders score the bid when it did
 * not. `declarerTeam` is a team index (0 or 1).
 */
/**
 * Points per team for a finished contract.
 *
 * The base rule: the contract team scores the tricks it took when it reaches
 * the bid, and the defenders score the bid when it does not.
 *
 * Kaboot is the whole hand. Bidding it and making it scores `kabootMade`;
 * failing it costs the declarer's team `kabootLoss` while the defenders score
 * `kabootDefence` times their own tricks. A team that sweeps all thirteen on a
 * lower bid is paid its tricks plus a `sweepBonus`. Every value is an option,
 * because the numbers differ from table to table.
 *
 * `declarerTeam` is a team index (0 or 1); the result is per team, and the
 * declarer's entry can be negative.
 */
export function tarneebScore(
  bid: number,
  declarerTeam: 0 | 1,
  tricks: [number, number],
  options: TarneebOptions = DEFAULT_TARNEEB,
): [number, number] {
  const points: [number, number] = [0, 0];
  const defenders: 0 | 1 = declarerTeam === 0 ? 1 : 0;
  const taken = tricks[declarerTeam];
  const made = taken >= bid;
  const swept = taken >= TARNEEB_HAND;
  const kaboot = bid >= options.kaboot;

  if (made) {
    if (kaboot) points[declarerTeam] = options.kabootMade;
    else if (swept) points[declarerTeam] = taken + options.sweepBonus;
    else points[declarerTeam] = taken;
  } else if (kaboot) {
    points[declarerTeam] = -options.kabootLoss;
    points[defenders] = options.kabootDefence * tricks[defenders];
  } else {
    points[defenders] = bid;
  }
  return points;
}

/** The round's points, per team. Throws if the round is not a played contract. */
export function scoreRound(round: TarneebRound): [number, number] {
  if (round.phase !== 'complete' || round.declarer === null || round.auction.highBid === null) {
    throw new Error('the round is not a scored contract');
  }
  return tarneebScore(round.auction.highBid, teamOf(round.declarer), round.tricks, round.options);
}
