// A match is a run of rounds played until one scoring unit reaches a target.
// The unit is a team in tarneeb (two seats each) and a single seat in trix, so
// the same scaffolding drives both; a game only has to say how many points a
// round is worth, per unit.
//
// The state is a plain value and every transition returns a new one.

import { nextSeat, type Seat } from './trick';

export interface MatchOptions {
  /** Seats around the table. */
  players: number;
  /**
   * Scoring units as seat groups. Teams for tarneeb — `[[0, 2], [1, 3]]` — or
   * one seat each for an individual game. Defaults to a unit per seat.
   */
  units?: Seat[][];
  /** Points a unit must reach to win the match. */
  target: number;
  /** The seat that deals the first round. Defaults to seat 0. */
  dealer?: Seat;
}

export interface MatchState {
  options: Required<MatchOptions>;
  /** Rounds played so far, starting at 0. */
  round: number;
  dealer: Seat;
  /** Points per unit, in `options.units` order. */
  scores: number[];
  /** Index into `options.units` of the winner, or null while the match is live. */
  winner: number | null;
}

export function createMatch(options: MatchOptions): MatchState {
  if (options.players < 2) throw new Error('a match needs at least two seats');
  const units = options.units ?? Array.from({ length: options.players }, (_, seat) => [seat]);
  const claimed = units.flat();
  if (claimed.length !== options.players || new Set(claimed).size !== options.players) {
    throw new Error('units must partition the seats exactly once');
  }
  return {
    options: { players: options.players, units, target: options.target, dealer: options.dealer ?? 0 },
    round: 0,
    dealer: options.dealer ?? 0,
    scores: units.map(() => 0),
    winner: null,
  };
}

/** The unit a seat scores for. */
export function unitOf(match: MatchState, seat: Seat): number {
  return match.options.units.findIndex((unit) => unit.includes(seat));
}

export function isMatchOver(match: MatchState): boolean {
  return match.winner !== null;
}

/**
 * Add one round's points, one value per unit, then rotate the deal. A unit that
 * reaches the target wins; if two reach it on the same round the higher score
 * takes it, and an exact tie leaves the match open.
 */
export function applyRound(match: MatchState, points: number[]): MatchState {
  if (points.length !== match.options.units.length) {
    throw new Error(`expected ${match.options.units.length} scores, got ${points.length}`);
  }
  const scores = match.scores.map((score, unit) => score + points[unit]);

  let winner = match.winner;
  if (winner === null) {
    const reached = scores
      .map((score, unit) => ({ score, unit }))
      .filter((entry) => entry.score >= match.options.target);
    if (reached.length > 0) {
      const best = Math.max(...reached.map((entry) => entry.score));
      const leaders = reached.filter((entry) => entry.score === best);
      if (leaders.length === 1) winner = leaders[0].unit;
    }
  }

  return {
    ...match,
    round: match.round + 1,
    dealer: nextSeat(match.dealer, match.options.players),
    scores,
    winner,
  };
}
