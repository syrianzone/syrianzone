import { describe, expect, it } from 'vitest';
import type { Card, Suit } from './cards';
import { createAuction } from './cardGames/bidding';
import {
  DEFAULT_TARNEEB,
  bid,
  chooseTrump,
  createRound,
  isRedeal,
  legalBids,
  legalPlays,
  pass,
  playCard,
  scoreRound,
  tarneebScore,
  teamOf,
  type TarneebRound,
} from './tarneeb';

const card = (rank: number, suit: Suit): Card => ({ id: `${suit}${rank}`, rank, suit, faceUp: true });

/** A small deterministic random source, so deals are reproducible. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** A playing-phase round built by hand, for the rule edge cases. */
function midRound(hands: Card[][], over: Partial<TarneebRound> = {}): TarneebRound {
  return {
    options: DEFAULT_TARNEEB,
    dealer: 0,
    hands,
    auction: { ...createAuction({ order: [0, 1, 2, 3], min: 7, max: 13 }), highBid: 9, highSeat: 0, complete: true, declarer: 0 },
    phase: 'playing',
    trump: 'S',
    declarer: 0,
    turn: 0,
    trick: [],
    tricks: [0, 0],
    history: [],
    ...over,
  };
}

describe('deal', () => {
  it('gives all four seats thirteen distinct cards', () => {
    const round = createRound(DEFAULT_TARNEEB, 0, seeded(7));
    expect(round.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(new Set(round.hands.flat().map((c) => c.id)).size).toBe(52);
  });

  it('opens the auction to the dealer\'s left', () => {
    expect(createRound(DEFAULT_TARNEEB, 0, seeded(1)).turn).toBe(1);
    expect(createRound(DEFAULT_TARNEEB, 2, seeded(1)).turn).toBe(3);
  });

  it('partners sit opposite each other', () => {
    expect(teamOf(0)).toBe(0);
    expect(teamOf(2)).toBe(0);
    expect(teamOf(1)).toBe(1);
    expect(teamOf(3)).toBe(1);
  });
});

describe('the auction', () => {
  it('offers the range, then only higher bids', () => {
    let round = createRound(DEFAULT_TARNEEB, 0, seeded(3));
    expect(legalBids(round)).toEqual([7, 8, 9, 10, 11, 12, 13]);
    round = bid(round, round.turn!, 8);
    expect(legalBids(round)).toEqual([9, 10, 11, 12, 13]);
  });

  it('hands the contract to the high bidder and asks them for a trump', () => {
    let round = createRound(DEFAULT_TARNEEB, 0, seeded(5));
    const opener = round.turn!;
    round = bid(round, opener, 7);
    while (round.phase === 'bidding') round = pass(round, round.turn!);
    expect(round.phase).toBe('trump');
    expect(round.declarer).toBe(opener);
    expect(round.auction.highBid).toBe(7);

    round = chooseTrump(round, opener, 'H');
    expect(round.phase).toBe('playing');
    expect(round.trump).toBe('H');
    expect(round.turn).toBe(opener); // the declarer leads
  });

  it('throws the deal in when everyone passes', () => {
    let round = createRound(DEFAULT_TARNEEB, 0, seeded(9));
    while (round.phase === 'bidding') round = pass(round, round.turn!);
    expect(round.phase).toBe('complete');
    expect(isRedeal(round)).toBe(true);
    expect(() => scoreRound(round)).toThrow();
  });
});

describe('playing a trick', () => {
  it('forces the led suit when it can be followed', () => {
    const round = midRound([[card(5, 'H'), card(2, 'S')]], {
      trick: [{ seat: 3, card: card(9, 'H') }],
      turn: 0,
    });
    expect(legalPlays(round, 0).map((c) => c.id)).toEqual(['H5']);
    expect(() => playCard(round, 0, card(2, 'S'))).toThrow();
    expect(playCard(round, 0, card(5, 'H')).trick.map((p) => p.card.id)).toEqual(['H9', 'H5']);
  });

  it('awards the trick to the highest trump, to the winner\'s team, and to their lead', () => {
    // The first three seats keep a spare card each so the trick is not the last
    // one of the round and the winner's turn to lead is observable.
    const round = midRound(
      [[card(4, 'C')], [card(5, 'C')], [card(6, 'C')], [card(2, 'S')]],
      {
        trick: [
          { seat: 0, card: card(11, 'H') },
          { seat: 1, card: card(3, 'H') },
          { seat: 2, card: card(13, 'H') },
        ],
        turn: 3,
      },
    );
    const done = playCard(round, 3, card(2, 'S'));
    expect(done.history).toHaveLength(1);
    expect(done.history[0].winner).toBe(3); // the spade trump
    expect(done.tricks).toEqual([0, 1]); // seat 3 is on team 1
    expect(done.turn).toBe(3); // the winner leads
    expect(done.trick).toEqual([]);
  });
});

describe('scoring', () => {
  it('scores the tricks taken when the contract is made', () => {
    expect(tarneebScore(8, 0, [8, 5])).toEqual([8, 0]);
    expect(tarneebScore(10, 1, [3, 10])).toEqual([0, 10]);
  });

  it('gives the bid to the defenders when the contract fails', () => {
    expect(tarneebScore(9, 0, [8, 5])).toEqual([0, 9]);
    expect(tarneebScore(10, 1, [4, 9])).toEqual([10, 0]);
  });
});

describe('a whole round', () => {
  it('plays thirteen tricks and scores them consistently', () => {
    let round = createRound(DEFAULT_TARNEEB, 0, seeded(42));
    // A scripted table: the opener takes the minimum, everyone else passes.
    while (round.phase === 'bidding') {
      round = round.auction.highBid === null
        ? bid(round, round.turn!, round.options.minBid)
        : pass(round, round.turn!);
    }
    round = chooseTrump(round, round.declarer!, 'S');
    while (round.phase === 'playing') {
      const seat = round.turn!;
      round = playCard(round, seat, legalPlays(round, seat)[0]);
    }

    expect(round.phase).toBe('complete');
    expect(round.history).toHaveLength(13);
    expect(round.tricks[0] + round.tricks[1]).toBe(13);
    expect(isRedeal(round)).toBe(false);
    // The engine's own score must agree with the standalone rule.
    expect(scoreRound(round)).toEqual(
      tarneebScore(round.auction.highBid!, teamOf(round.declarer!), round.tricks),
    );
  });
});
