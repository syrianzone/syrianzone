import { describe, expect, it } from 'vitest';
import { applyRound, createMatch, isMatchOver, unitOf } from './match';

describe('createMatch', () => {
  it('makes a unit per seat by default', () => {
    const match = createMatch({ players: 4, target: 41 });
    expect(match.options.units).toEqual([[0], [1], [2], [3]]);
    expect(match.scores).toEqual([0, 0, 0, 0]);
    expect(match.round).toBe(0);
  });

  it('accepts teams', () => {
    const match = createMatch({ players: 4, units: [[0, 2], [1, 3]], target: 41 });
    expect(unitOf(match, 0)).toBe(0);
    expect(unitOf(match, 2)).toBe(0);
    expect(unitOf(match, 1)).toBe(1);
    expect(unitOf(match, 3)).toBe(1);
  });

  it('rejects units that do not cover every seat exactly once', () => {
    expect(() => createMatch({ players: 4, units: [[0, 1]], target: 41 })).toThrow();
    expect(() => createMatch({ players: 4, units: [[0, 1], [1, 2], [3]], target: 41 })).toThrow();
  });
});

describe('applyRound', () => {
  it('adds the points per unit, rotates the deal and counts the round', () => {
    const match = createMatch({ players: 4, units: [[0, 2], [1, 3]], target: 41 });
    const next = applyRound(match, [10, 3]);
    expect(next.scores).toEqual([10, 3]);
    expect(next.round).toBe(1);
    expect(next.dealer).toBe(1);
    expect(isMatchOver(next)).toBe(false);
  });

  it('rounds the dealer back to the first seat', () => {
    let match = createMatch({ players: 4, target: 41, dealer: 3 });
    match = applyRound(match, [0, 0, 0, 0]);
    expect(match.dealer).toBe(0);
  });

  it('declares a unit that reaches the target', () => {
    const match = createMatch({ players: 4, units: [[0, 2], [1, 3]], target: 41 });
    const next = applyRound(match, [41, 0]);
    expect(next.winner).toBe(0);
    expect(isMatchOver(next)).toBe(true);
  });

  it('keeps the match open when two units reach the target exactly level', () => {
    let match = createMatch({ players: 4, units: [[0, 2], [1, 3]], target: 41 });
    match = applyRound(match, [41, 41]);
    expect(match.winner).toBeNull();
    // A later round can still separate them.
    match = applyRound(match, [0, 3]);
    expect(match.winner).toBe(1);
  });

  it('does not overwrite a decided winner on a later round', () => {
    let match = createMatch({ players: 4, units: [[0, 2], [1, 3]], target: 41 });
    match = applyRound(match, [41, 0]);
    match = applyRound(match, [0, 41]);
    expect(match.winner).toBe(0);
  });

  it('rejects the wrong number of scores', () => {
    const match = createMatch({ players: 4, units: [[0, 2], [1, 3]], target: 41 });
    expect(() => applyRound(match, [1, 2, 3])).toThrow();
  });
});
