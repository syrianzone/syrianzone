// An ascending auction: seats take turns either bidding higher than the best
// bid so far or passing, until all but the highest bidder have passed (or
// everyone passes, and there is no contract). It is the skeleton tarneeb's
// 7–13 bidding shares with baloot and most other auction games; the meaning of
// a bid and what happens after the auction are the game's own business.
//
// Pure value in, pure value out — the state is never mutated.

import type { Seat } from './trick';

export type AuctionAction = { seat: Seat; value: number } | { seat: Seat; pass: true };

export interface AuctionOptions {
  /** Seats in bidding order. */
  order: Seat[];
  /** Smallest legal bid. */
  min: number;
  /** Largest legal bid. */
  max: number;
}

export interface Auction {
  options: AuctionOptions;
  /** Index into `options.order` of the seat on turn. */
  turn: number;
  highBid: number | null;
  highSeat: Seat | null;
  /** Seats that have passed, in the order they did. */
  passed: Seat[];
  actions: AuctionAction[];
  complete: boolean;
  /** The winning seat, or null when everyone passed. */
  declarer: Seat | null;
}

export function createAuction(options: AuctionOptions): Auction {
  if (options.order.length < 2) throw new Error('an auction needs at least two seats');
  if (options.min > options.max) throw new Error('min exceeds max');
  return { options, turn: 0, highBid: null, highSeat: null, passed: [], actions: [], complete: false, declarer: null };
}

export function currentSeat(auction: Auction): Seat {
  return auction.options.order[auction.turn];
}

/** Every bid the seat on turn is allowed to make. */
export function legalBids(auction: Auction): number[] {
  if (auction.complete) return [];
  const floor = auction.highBid ?? auction.options.min - 1;
  const out: number[] = [];
  for (let value = floor + 1; value <= auction.options.max; value++) out.push(value);
  return out;
}

/**
 * Advance to the next seat still in the auction, or settle it. With a bid on
 * the table the auction ends as soon as all but the high bidder have passed; if
 * nobody has bid yet it runs until every seat has passed, so the last seat to
 * act still gets to open.
 */
function settle(auction: Auction): Auction {
  const { order } = auction.options;
  const active = order.filter((seat) => !auction.passed.includes(seat));
  if (auction.highSeat !== null && active.length <= 1) {
    return { ...auction, complete: true, declarer: auction.highSeat };
  }
  if (auction.highSeat === null && active.length === 0) {
    return { ...auction, complete: true, declarer: null };
  }
  let turn = auction.turn;
  do {
    turn = (turn + 1) % order.length;
  } while (auction.passed.includes(order[turn]));
  return { ...auction, turn };
}

function assertTurn(auction: Auction, seat: Seat): void {
  if (auction.complete) throw new Error('the auction is over');
  if (seat !== currentSeat(auction)) throw new Error(`seat ${seat} is not on turn`);
}

export function placeBid(auction: Auction, seat: Seat, value: number): Auction {
  assertTurn(auction, seat);
  if (!legalBids(auction).includes(value)) throw new Error(`illegal bid ${value}`);
  return settle({ ...auction, highBid: value, highSeat: seat, actions: [...auction.actions, { seat, value }] });
}

export function passAuction(auction: Auction, seat: Seat): Auction {
  assertTurn(auction, seat);
  if (seat === auction.highSeat) throw new Error('the high bidder has nothing to pass');
  return settle({ ...auction, passed: [...auction.passed, seat], actions: [...auction.actions, { seat, pass: true }] });
}
