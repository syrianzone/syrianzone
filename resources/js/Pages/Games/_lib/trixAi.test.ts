import { describe, expect, it } from 'vitest';
import type { Card, Suit } from './cards';
import {
  DEFAULT_TRIX,
  beginDeal,
  chooseContract,
  createGame,
  finishDeal,
  kingOf,
  pass,
  playCard,
  type TrixDeal,
  type TrixGame,
  type TrixOptions,
} from './trix';
import { chooseContractFor, choosePlay, fit } from './trixAi';

const card = (rank: number, suit: Suit): Card => ({ id: `${suit}${rank}`, rank, suit, faceUp: true });

function avoidDeal(
  contract: TrixDeal['contract'],
  over: Partial<Exclude<TrixDeal, { contract: 'trix' }>> = {},
): TrixDeal {
  return {
    contract,
    round: {
      players: 4,
      hands: [[], [], [], []],
      leader: 0,
      turn: 1,
      trick: [],
      history: [],
      collected: [[], [], [], []],
    },
    phase: 'playing',
    ...over,
  } as TrixDeal;
}

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe('avoidance play', () => {
  it('ducks under the card that is winning when it can', () => {
    const deal = avoidDeal('tricks', {
      round: {
        players: 4,
        hands: [[], [card(5, 'H'), card(9, 'H')], [], []],
        leader: 0,
        turn: 1,
        trick: [{ seat: 0, card: card(13, 'H') }],
        history: [],
        collected: [[], [], [], []],
      },
    });
    expect(choosePlay(deal, 1, DEFAULT_TRIX)?.id).toBe('H5'); // the lower of two losers
  });

  it('sheds the contract penalty when void', () => {
    const deal = avoidDeal('kingOfHearts', {
      round: {
        players: 4,
        hands: [[], [], [], [card(13, 'H'), card(2, 'S')]],
        leader: 0,
        turn: 3,
        trick: [{ seat: 0, card: card(5, 'D') }],
        history: [],
        collected: [[], [], [], []],
      },
    });
    expect(choosePlay(deal, 3, DEFAULT_TRIX)?.id).toBe('H13');
  });

  it('leaves a winning partner alone in coop', () => {
    const deal = avoidDeal('kingOfHearts', {
      round: {
        players: 4,
        hands: [[], [], [], [card(13, 'H'), card(2, 'S')]],
        leader: 1,
        turn: 3,
        trick: [{ seat: 1, card: card(13, 'D') }], // seat 1 is seat 3's partner
        history: [],
        collected: [[], [], [], []],
      },
    });
    // Would normally dump H13; in coop the partner is winning, so it plays low.
    expect(choosePlay(deal, 3, { teams: true })?.id).toBe('S2');
    expect(choosePlay(deal, 3, DEFAULT_TRIX)?.id).toBe('H13');
  });
});

describe('the trix contract', () => {
  it('lays the only legal card, and passes when stuck', () => {
    const deal: TrixDeal = {
      contract: 'trix',
      hands: [[card(11, 'S'), card(2, 'H')], [], [], []],
      layout: { runs: {}, laid: {} },
      turn: 0,
      out: [],
      phase: 'playing',
    };
    expect(choosePlay(deal, 0, DEFAULT_TRIX)?.id).toBe('S11');

    const stuck: TrixDeal = { ...deal, hands: [[card(2, 'H')], [], [], []] };
    expect(choosePlay(stuck, 0, DEFAULT_TRIX)).toBeNull();
  });
});

describe('choosing a contract', () => {
  it('prefers the contract a hand avoids the penalties of', () => {
    const clean = [card(2, 'S'), card(3, 'S'), card(4, 'S')];
    const dirty = [card(12, 'S'), card(12, 'H'), card(13, 'S')];
    expect(fit(clean, 'queens')).toBeGreaterThan(fit(dirty, 'queens'));

    const chosen = chooseContractFor([clean, dirty, clean, dirty], 0, ['queens', 'diamonds', 'tricks', 'kingOfHearts', 'trix']);
    expect(['queens', 'diamonds', 'tricks', 'kingOfHearts', 'trix']).toContain(chosen);
  });
});

describe('a whole session', () => {
  function playDeal(deal: TrixDeal): TrixDeal {
    let d = deal;
    let guard = 0;
    while (d.phase !== 'complete' && guard++ < 500) {
      const seat = d.contract === 'trix' ? d.turn : d.round.turn;
      const play = choosePlay(d, seat, DEFAULT_TRIX);
      d = play ? playCard(d, seat, play) : pass(d, seat);
    }
    return d;
  }

  function session(seed: number, options: TrixOptions = DEFAULT_TRIX): TrixGame {
    let game = createGame(options, seeded(seed));
    let guard = 0;
    while (!game.complete && guard++ < 40) {
      game = beginDeal(game, seeded(seed * 7919 + guard));
      const contract = chooseContractFor(game.hands!, kingOf(game), game.remaining);
      game = chooseContract(game, contract);
      game = finishDeal({ ...game, deal: playDeal(game.deal!) });
    }
    return game;
  }

  it('plays all twenty deals and sums to zero', () => {
    for (const seed of [1, 2, 3]) {
      const game = session(seed);
      expect(game.complete).toBe(true);
      expect(game.history).toHaveLength(20); // four kingdoms of five
      // Every contract totals a fixed amount that cancels across a kingdom.
      expect(game.scores.reduce((a, b) => a + b, 0)).toBe(0);
    }
  });

  it('runs in coop without breaking the same invariants', () => {
    const game = session(5, { teams: true });
    expect(game.complete).toBe(true);
    expect(game.scores.reduce((a, b) => a + b, 0)).toBe(0);
  });
});
