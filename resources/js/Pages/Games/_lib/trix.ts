// Trix (تركس), the Levantine compendium game. Four players, no trump, and a
// session of twenty deals: four kingdoms (ممالك), each owned by one player, who
// picks the order of their five contracts (طلبات). Highest total wins.
//
// The four avoidance contracts reduce to the shared `avoidance.ts` round; the
// fifth, the positive التركس contract, is a domino layout from the Jacks in
// `shedding.ts`. This module is the part that is specifically Trix: the
// contracts, their scoring, and the kingdom structure.
//
// CONVENTIONS. The common rules are used: queens −25, diamonds −10, tricks −15,
// شيخ الكبة −75, and التركس paying +200/+150/+100/+50 by finish. Nothing is
// doubled (التدبيل) yet, deals always run their course (no early end), and the
// direction the kingdoms pass is seat order. Values that a table is likely to
// change (partnerships) are options.

import { createDeck, shuffle, type Card, type Suit } from './cards';
import { createAvoidanceRound, isComplete as avoidanceComplete, legalPlays as avoidanceLegal, playCard as avoidancePlay, type AvoidanceRound } from './cardGames/avoidance';
import { emptyLayout, lay, legalCards, type ShedLayout } from './cardGames/shedding';
import { nextSeat, type Seat } from './cardGames/trick';

export const TRIX_PLAYERS = 4;
export const TRIX_HAND = 13;
/** The layout's pivot: the Jack. */
export const TRIX_PIVOT = 11;
/** Jack, then up to the ace and down to the two. */
const TRIX_POSITION = [200, 150, 100, 50];

export type Contract = 'queens' | 'diamonds' | 'tricks' | 'kingOfHearts' | 'trix';
export const CONTRACTS: Contract[] = ['queens', 'diamonds', 'tricks', 'kingOfHearts', 'trix'];

/** The five contracts, with the table's own names. */
export const CONTRACT_INFO: Record<Contract, { name: string; kind: 'avoid' | 'shed' }> = {
  queens: { name: 'البنات', kind: 'avoid' },
  diamonds: { name: 'الديناري', kind: 'avoid' },
  tricks: { name: 'اللطوش', kind: 'avoid' },
  kingOfHearts: { name: 'شيخ الكبة', kind: 'avoid' },
  trix: { name: 'التركس', kind: 'shed' },
};

export interface TrixOptions {
  /** فريقين (partnerships) or يهودية (every player alone). */
  teams: boolean;
}

export const DEFAULT_TRIX: TrixOptions = { teams: false };

// ---- a deal -----------------------------------------------------------------

interface TrixAvoidDeal {
  contract: 'queens' | 'diamonds' | 'tricks' | 'kingOfHearts';
  round: AvoidanceRound;
  phase: 'playing' | 'complete';
}

interface TrixShedDeal {
  contract: 'trix';
  hands: Card[][];
  layout: ShedLayout;
  turn: Seat;
  /** Seats in the order they emptied their hand. */
  out: Seat[];
  phase: 'playing' | 'complete';
}

export type TrixDeal = TrixAvoidDeal | TrixShedDeal;

/** Four hands of thirteen, dealt from a full deck. */
export function dealHands(random: () => number = Math.random): Card[][] {
  const deck = shuffle(createDeck(), random).map((card) => ({ ...card, faceUp: true }));
  return Array.from({ length: TRIX_PLAYERS }, (_, seat) =>
    deck.slice(seat * TRIX_HAND, seat * TRIX_HAND + TRIX_HAND),
  );
}

/** Put a contract on already-dealt hands — the king sees the hand before choosing. */
export function buildDeal(contract: Contract, hands: Card[][], leader: Seat): TrixDeal {
  if (contract === 'trix') {
    return { contract, hands, layout: emptyLayout(), turn: leader, out: [], phase: 'playing' };
  }
  return { contract, round: createAvoidanceRound(hands, leader), phase: 'playing' };
}

/** A whole deal in one call: a fresh deal plus its contract. */
export function createDeal(contract: Contract, dealer: Seat, random: () => number = Math.random): TrixDeal {
  return buildDeal(contract, dealHands(random), dealer);
}

/** The cards a seat may play right now; empty when it is not their turn. */
export function legalPlays(deal: TrixDeal, seat: Seat): Card[] {
  if (deal.phase !== 'playing') return [];

  if (deal.contract === 'trix') {
    if (deal.turn !== seat) return [];
    return legalCards(deal.layout, deal.hands[seat], TRIX_PIVOT);
  }

  if (deal.round.turn !== seat) return [];
  // In شيخ الكبة a heart may not be led unless hearts are all the seat holds.
  return avoidanceLegal(deal.round, seat, deal.contract === 'kingOfHearts' ? 'H' : undefined);
}

export function playCard(deal: TrixDeal, seat: Seat, card: Card): TrixDeal {
  if (deal.phase !== 'playing') throw new Error('the deal is over');
  if (!legalPlays(deal, seat).some((c) => c.id === card.id)) throw new Error(`illegal play ${card.id}`);

  if (deal.contract === 'trix') {
    const hands = deal.hands.map((hand, i) => (i === seat ? hand.filter((c) => c.id !== card.id) : hand));
    const out = hands[seat].length === 0 ? [...deal.out, seat] : deal.out;
    const complete = out.length >= TRIX_PLAYERS - 1;
    return {
      ...deal,
      hands,
      layout: lay(deal.layout, card, TRIX_PIVOT),
      out,
      turn: complete ? deal.turn : nextActive(seat, out),
      phase: complete ? 'complete' : 'playing',
    };
  }

  const round = avoidancePlay(deal.round, seat, card, deal.contract === 'kingOfHearts' ? 'H' : undefined);
  return { ...deal, round, phase: avoidanceComplete(round) ? 'complete' : 'playing' };
}

/** The التركس contract's only non-play action, legal only when nothing can be laid. */
export function pass(deal: TrixDeal, seat: Seat): TrixDeal {
  if (deal.contract !== 'trix' || deal.phase !== 'playing' || deal.turn !== seat) {
    throw new Error('not a passable turn');
  }
  if (legalPlays(deal, seat).length > 0) throw new Error('a card can still be laid');
  return { ...deal, turn: nextActive(seat, deal.out) };
}

function nextActive(seat: Seat, out: Seat[]): Seat {
  let next = nextSeat(seat, TRIX_PLAYERS);
  while (out.includes(next)) next = nextSeat(next, TRIX_PLAYERS);
  return next;
}

export function isDealComplete(deal: TrixDeal): boolean {
  return deal.phase === 'complete';
}

/** Points per seat for a finished deal. */
export function scoreDeal(deal: TrixDeal): number[] {
  if (deal.contract === 'trix') {
    const order = [...deal.out];
    if (order.length < TRIX_PLAYERS) {
      const last = [0, 1, 2, 3].find((seat) => !order.includes(seat));
      if (last !== undefined) order.push(last);
    }
    const points = [0, 0, 0, 0];
    order.forEach((seat, place) => {
      points[seat] = TRIX_POSITION[place] ?? 0;
    });
    return points;
  }

  const points = [0, 0, 0, 0];
  // `-25 * 0` is `-0`, which reads badly and compares oddly; keep plain zeros.
  const penalty = (count: number, unit: number) => (count === 0 ? 0 : -unit * count);
  for (let seat = 0; seat < TRIX_PLAYERS; seat++) {
    const cards = deal.round.collected[seat];
    if (deal.contract === 'queens') points[seat] = penalty(cards.filter((c) => c.rank === 12).length, 25);
    else if (deal.contract === 'diamonds') points[seat] = penalty(cards.filter((c) => c.suit === 'D').length, 10);
    else if (deal.contract === 'tricks') points[seat] = penalty(deal.round.history.filter((t) => t.winner === seat).length, 15);
    else points[seat] = cards.some((c) => c.id === 'H13') ? -75 : 0;
  }
  return points;
}

// ---- the session ------------------------------------------------------------

export interface TrixGame {
  options: TrixOptions;
  /** The seat dealt the 7♥, who opens the first kingdom. */
  firstKing: Seat;
  scores: number[];
  /** 0..3. */
  kingdom: number;
  /** Contracts left to choose in the current kingdom. */
  remaining: Contract[];
  /** The cards dealt and awaiting the king's contract choice. */
  hands: Card[][] | null;
  deal: TrixDeal | null;
  complete: boolean;
  history: { contract: Contract; king: Seat; points: number[] }[];
}

export const kingOf = (game: TrixGame): Seat => (game.firstKing + game.kingdom) % TRIX_PLAYERS;

export function createGame(options: TrixOptions = DEFAULT_TRIX, random: () => number = Math.random): TrixGame {
  // The first deal only decides who opens the first kingdom: whoever holds 7♥.
  const deck = shuffle(createDeck(), random);
  const firstKing = Math.floor(deck.findIndex((card) => card.id === 'H7') / TRIX_HAND);
  return {
    options,
    firstKing,
    scores: [0, 0, 0, 0],
    kingdom: 0,
    remaining: [...CONTRACTS],
    hands: null,
    deal: null,
    complete: false,
    history: [],
  };
}

/** Deal the cards for the next contract; the king then picks one. */
export function beginDeal(game: TrixGame, random: () => number = Math.random): TrixGame {
  if (game.complete) throw new Error('the session is over');
  if (game.deal || game.hands) throw new Error('a deal is already open');
  return { ...game, hands: dealHands(random) };
}

/** The king names a contract for the dealt hand. */
export function chooseContract(game: TrixGame, contract: Contract): TrixGame {
  if (game.complete || game.deal) throw new Error('no contract to choose');
  if (!game.hands) throw new Error('no cards are dealt');
  if (!game.remaining.includes(contract)) throw new Error(`${contract} is not available`);
  return { ...game, hands: null, deal: buildDeal(contract, game.hands, kingOf(game)) };
}

/** Score the finished deal, then move to the next contract or kingdom. */
export function finishDeal(game: TrixGame): TrixGame {
  const deal = game.deal;
  if (!deal || deal.phase !== 'complete') throw new Error('the deal is not finished');

  const points = scoreDeal(deal);
  const scores = game.scores.map((score, seat) => score + points[seat]);
  const history = [...game.history, { contract: deal.contract, king: kingOf(game), points }];

  const remaining = game.remaining.filter((contract) => contract !== deal.contract);
  if (remaining.length > 0) {
    return { ...game, scores, remaining, deal: null, history };
  }

  const kingdom = game.kingdom + 1;
  const complete = kingdom >= TRIX_PLAYERS;
  return {
    ...game,
    scores,
    kingdom,
    complete,
    remaining: complete ? [] : [...CONTRACTS],
    deal: null,
    history,
  };
}

/** The scoring units: partners when teams are on, otherwise every seat alone. */
export function gameUnits(game: TrixGame): number[][] {
  return game.options.teams ? [[0, 2], [1, 3]] : [[0], [1], [2], [3]];
}

/** Cumulative totals per unit, and the winning unit (or null on a tie). */
export function standings(game: TrixGame): { totals: number[]; winner: number | null } {
  const totals = gameUnits(game).map((unit) => unit.reduce((sum, seat) => sum + game.scores[seat], 0));
  const best = Math.max(...totals);
  const leaders = totals.filter((total) => total === best);
  return { totals, winner: leaders.length === 1 ? totals.indexOf(best) : null };
}
