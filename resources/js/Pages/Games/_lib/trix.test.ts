import { describe, expect, it } from 'vitest';
import type { Card, Suit } from './cards';
import {
  CONTRACTS,
  DEFAULT_TRIX,
  type Contract,
  type TrixDeal,
  type TrixGame,
  createDeal,
  createGame,
  beginDeal,
  chooseContract,
  finishDeal,
  kingOf,
  legalPlays,
  playCard,
  scoreDeal,
  standings,
} from './trix';

const card = (rank: number, suit: Suit): Card => ({ id: `${suit}${rank}`, rank, suit, faceUp: true });

/** Narrow a deal to the avoidance shape / the shed shape. */
function avoid(deal: TrixDeal) {
  if (deal.contract === 'trix') throw new Error('expected an avoidance deal');
  return deal;
}
function shed(deal: TrixDeal) {
  if (deal.contract !== 'trix') throw new Error('expected a shed deal');
  return deal;
}

/** A finished avoidance deal with the collections a test wants to score. */
function finishedDeal(contract: TrixDeal['contract'], collected: Card[][], winners: number[] = []): TrixDeal {
  if (contract === 'trix') throw new Error('use a shed deal');
  return {
    contract,
    round: {
      players: 4,
      hands: [[], [], [], []],
      leader: 0,
      turn: 0,
      trick: [],
      history: winners.map((winner) => ({ plays: [], winner })),
      collected,
    },
    phase: 'complete',
  };
}

function game(overrides: Partial<TrixGame> = {}): TrixGame {
  return {
    options: DEFAULT_TRIX,
    firstKing: 0,
    scores: [0, 0, 0, 0],
    kingdom: 0,
    remaining: [...CONTRACTS],
    hands: null,
    deal: null,
    complete: false,
    history: [],
    ...overrides,
  };
}

describe('the deal', () => {
  it('gives four hands of thirteen distinct cards', () => {
    const deal = avoid(createDeal('queens', 0, () => 0.42));
    expect(deal.round.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(new Set(deal.round.hands.flat().map((c) => c.id)).size).toBe(52);
  });

  it('follows suit in an avoidance contract', () => {
    const deal = avoid(createDeal('queens', 0, () => 0.3));
    const leader = deal.round.turn;
    const first = legalPlays(deal, leader)[0];
    const after = avoid(playCard(deal, leader, first));
    const next = legalPlays(after, after.round.turn);
    const ledSuit = first.suit;
    const hasSuit = after.round.hands[after.round.turn].some((c) => c.suit === ledSuit);
    if (hasSuit) expect(next.every((c) => c.suit === ledSuit)).toBe(true);
  });

  it('starts a shed deal at the Jacks', () => {
    const deal = shed(createDeal('trix', 0, () => 0.5));
    const legal = legalPlays(deal, deal.turn);
    // Whatever the hand, only Jacks are ever playable on an empty layout.
    expect(legal.every((c) => c.rank === 11)).toBe(true);
  });
});

describe('scoring', () => {
  it('queens: minus twenty-five each', () => {
    const deal = finishedDeal('queens', [
      [card(12, 'S')],
      [card(12, 'H'), card(12, 'D')],
      [],
      [card(12, 'C')],
    ]);
    expect(scoreDeal(deal)).toEqual([-25, -50, 0, -25]);
  });

  it('diamonds: minus ten each', () => {
    const deal = finishedDeal('diamonds', [[card(5, 'D'), card(1, 'S')], [card(9, 'D')], [], []]);
    expect(scoreDeal(deal)).toEqual([-10, -10, 0, 0]);
  });

  it('tricks: minus fifteen each', () => {
    const deal = finishedDeal('tricks', [[], [], [], []], [0, 0, 2, 2, 2]);
    expect(scoreDeal(deal)).toEqual([-30, 0, -45, 0]);
  });

  it('king of hearts: the taker pays seventy-five', () => {
    const deal = finishedDeal('kingOfHearts', [[card(13, 'H'), card(2, 'H')], [], [], []]);
    expect(scoreDeal(deal)).toEqual([-75, 0, 0, 0]);
  });

  it('trix: pays by finish, and the last seat takes fifty', () => {
    const deal: TrixDeal = {
      contract: 'trix',
      hands: [[card(2, 'S')], [], [], []],
      layout: { runs: {}, laid: {} },
      turn: 1,
      out: [1, 2, 3],
      phase: 'complete',
    };
    expect(scoreDeal(deal)).toEqual([50, 200, 150, 100]);
  });
});

describe('the session', () => {
  it('opens with the seat dealt the seven of hearts', () => {
    const game0 = createGame(DEFAULT_TRIX, () => 0.6);
    expect(game0.firstKing).toBeGreaterThanOrEqual(0);
    expect(game0.firstKing).toBeLessThan(4);
    expect(game0.remaining).toEqual(CONTRACTS);
  });

  it('advances the king by kingdom', () => {
    const g = game({ firstKing: 2, kingdom: 1 });
    expect(kingOf(g)).toBe(3);
  });

  it('deals first, then lets the king name a contract', () => {
    const dealt = beginDeal(game({ firstKing: 1 }), () => 0.4);
    expect(dealt.hands?.map((h) => h.length)).toEqual([13, 13, 13, 13]);

    const chosen = chooseContract(dealt, 'kingOfHearts');
    expect(chosen.hands).toBeNull();
    expect(chosen.deal?.contract).toBe('kingOfHearts');

    expect(() => chooseContract(dealt, 'trix')).not.toThrow();
    expect(() => chooseContract(game({ hands: null }), 'trix')).toThrow();
    expect(() => chooseContract(dealt, 'not-a-contract' as never)).toThrow();
  });

  it('drops the played contract and scores it', () => {
    const deal = finishedDeal('queens', [[card(12, 'S')], [], [], []]);
    const after = finishDeal(game({ deal }));
    expect(after.scores).toEqual([-25, 0, 0, 0]);
    expect(after.remaining).toEqual(['diamonds', 'tricks', 'kingOfHearts', 'trix']);
    expect(after.deal).toBeNull();
  });

  it('moves to the next kingdom after the fifth contract, and ends after the fourth', () => {
    const deal = finishedDeal('diamonds', [[], [], [], []]);
    const next = finishDeal(game({ kingdom: 0, remaining: ['diamonds'], deal }));
    expect(next.kingdom).toBe(1);
    expect(next.remaining).toEqual(CONTRACTS);

    const done = finishDeal(game({ kingdom: 3, remaining: ['diamonds'], deal }));
    expect(done.complete).toBe(true);
  });

  it('ranks seats alone, or by team when partnerships are on', () => {
    const solo = game({ scores: [10, 40, -10, 0] });
    expect(standings(solo)).toEqual({ totals: [10, 40, -10, 0], winner: 1 });

    const coop = game({ options: { teams: true }, scores: [10, 40, 30, -5] });
    expect(standings(coop)).toEqual({ totals: [40, 35], winner: 0 });

    const tie = game({ options: { teams: true }, scores: [10, 40, 30, 0] });
    expect(standings(tie).winner).toBeNull();
  });
});
