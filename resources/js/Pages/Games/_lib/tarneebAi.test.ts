import { describe, expect, it } from 'vitest';
import { SUITS, type Card, type Suit } from './cards';
import {
  DEFAULT_TARNEEB,
  bid,
  chooseTrump as engineChooseTrump,
  createRound,
  legalPlays,
  pass,
  playCard,
  scoreRound,
  type TarneebRound,
} from './tarneeb';
import { bestTrump, chooseBid, choosePlay, chooseTrump, estimateTricks } from './tarneebAi';

const card = (rank: number, suit: Suit): Card => ({ id: `${suit}${rank}`, rank, suit, faceUp: true });

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Seven trumps plus every ace and king: thirteen estimated tricks.
const STRONG: Card[] = [
  card(1, 'S'), card(13, 'S'), card(12, 'S'), card(11, 'S'), card(10, 'S'), card(9, 'S'), card(8, 'S'),
  card(1, 'H'), card(13, 'H'),
  card(1, 'D'),
  card(1, 'C'), card(13, 'C'), card(12, 'C'),
];

// Nothing above a five, and only three trumps.
const WEAK: Card[] = [
  card(2, 'S'), card(3, 'S'), card(4, 'S'),
  card(2, 'H'), card(3, 'H'), card(4, 'H'),
  card(2, 'D'), card(3, 'D'), card(4, 'D'),
  card(2, 'C'), card(3, 'C'), card(4, 'C'), card(5, 'C'),
];

const ALL_SPADES: Card[] = Array.from({ length: 13 }, (_, i) => card(i + 1, 'S'));

/** Replace one seat's hand, leaving the rest of the round as dealt. */
function withHand(round: TarneebRound, seat: number, hand: Card[]): TarneebRound {
  return { ...round, hands: round.hands.map((h, i) => (i === seat ? hand : h)) };
}

describe('estimateTricks', () => {
  it('counts every trump and the top honours elsewhere', () => {
    expect(estimateTricks(ALL_SPADES, 'S')).toBe(13);
    expect(estimateTricks(WEAK, 'S')).toBe(3); // three trumps, no side honours
    expect(estimateTricks(STRONG, 'S')).toBe(13);
  });
});

describe('bestTrump', () => {
  it('always chooses a trump that maximises the estimate', () => {
    for (const seed of [1, 2, 3, 99]) {
      const hand = createRound(DEFAULT_TARNEEB, 0, seeded(seed)).hands[0];
      const { trump } = bestTrump(hand);
      const best = Math.max(...SUITS.map((suit) => estimateTricks(hand, suit)));
      expect(estimateTricks(hand, trump)).toBe(best);
    }
  });

  it('names the suit a hand is made of', () => {
    expect(bestTrump(ALL_SPADES).trump).toBe('S');
  });
});

describe('chooseBid', () => {
  it('bids on a strong hand and passes on a weak one', () => {
    const round = createRound(DEFAULT_TARNEEB, 0, seeded(7));
    const seat = round.turn!;
    const strong = chooseBid(withHand(round, seat, STRONG), seat);
    expect(strong).toBeGreaterThanOrEqual(DEFAULT_TARNEEB.minBid);
    expect(chooseBid(withHand(round, seat, WEAK), seat)).toBeNull();
  });
});

describe('chooseTrump and choosePlay', () => {
  it('names the best suit, then always plays a legal card', () => {
    // Give the opener an unbeatable hand so it wins the auction outright.
    const start = createRound(DEFAULT_TARNEEB, 0, seeded(3));
    const opener = start.turn!;
    let round = withHand(start, opener, ALL_SPADES);
    while (round.phase === 'bidding') {
      const seat = round.turn!;
      const value = chooseBid(round, seat);
      round = value === null ? pass(round, seat) : bid(round, seat, value);
    }
    expect(round.declarer).toBe(opener);
    expect(chooseTrump(round, opener)).toBe('S');

    round = engineChooseTrump(round, opener, 'S');
    const leader = round.turn!;
    expect(legalPlays(round, leader)).toContainEqual(choosePlay(round, leader));
  });
});

describe('AI-vs-AI simulation', () => {
  it('plays many rounds without a bad move, and every one adds up', () => {
    let redeals = 0;
    for (let seed = 1; seed <= 200; seed++) {
      let round = createRound(DEFAULT_TARNEEB, seed % 4, seeded(seed));

      while (round.phase === 'bidding') {
        const seat = round.turn!;
        const value = chooseBid(round, seat);
        round = value === null ? pass(round, seat) : bid(round, seat, value);
      }

      if (round.phase === 'complete') {
        // Everyone passed and the deal is thrown in.
        expect(round.declarer).toBeNull();
        redeals += 1;
        continue;
      }

      const declarer = round.declarer!;
      round = engineChooseTrump(round, declarer, chooseTrump(round, declarer));

      while (round.phase === 'playing') {
        const seat = round.turn!;
        const card = choosePlay(round, seat);
        expect(legalPlays(round, seat)).toContainEqual(card); // never an illegal move
        round = playCard(round, seat, card);
      }

      expect(round.phase).toBe('complete');
      expect(round.history).toHaveLength(13);
      expect(round.tricks[0] + round.tricks[1]).toBe(13);
      expect(round.auction.highBid).toBeGreaterThanOrEqual(DEFAULT_TARNEEB.minBid);

      // Exactly one team scores a round: the contract when made, the defenders
      // when it fails.
      const points = scoreRound(round);
      expect(points.filter((p) => p > 0)).toHaveLength(1);
    }

    // The table is active enough to be worth simulating, but passes sometimes.
    expect(redeals).toBeGreaterThan(0);
    expect(redeals).toBeLessThan(200);
  });
});
