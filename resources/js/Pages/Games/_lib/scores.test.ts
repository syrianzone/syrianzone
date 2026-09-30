import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readRecord, readStats, recordMatch, recordResult } from './scores';

/** A Map-backed localStorage, since the node test environment has no window. */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => void map.set(key, String(value)),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  } as unknown as Storage;
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: fakeStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('best-record games', () => {
  it('keeps the biggest score for a "higher" record', () => {
    expect(recordResult('2048', 100, 'higher')).toEqual({ record: 100, improved: true });
    expect(recordResult('2048', 50, 'higher')).toEqual({ record: 100, improved: false });
    expect(recordResult('2048', 200, 'higher')).toEqual({ record: 200, improved: true });
    expect(readRecord('2048')).toBe(200);
  });

  it('keeps the shortest time for a "lower" record, and treats an unset one as beatable', () => {
    expect(readRecord('solitare')).toBe(0); // nothing yet
    expect(recordResult('solitare', 120, 'lower')).toEqual({ record: 120, improved: true });
    expect(recordResult('solitare', 200, 'lower')).toEqual({ record: 120, improved: false });
    expect(recordResult('solitare', 90, 'lower')).toEqual({ record: 90, improved: true });
    expect(readRecord('solitare')).toBe(90);
  });
});

describe('match tallies', () => {
  it('starts empty', () => {
    expect(readStats('tarneeb')).toEqual({ played: 0, wins: 0, losses: 0, draws: 0 });
  });

  it('counts each finished match, and reads the tally back', () => {
    recordMatch('tarneeb', 'win');
    const afterTwo = recordMatch('tarneeb', 'loss');
    expect(afterTwo).toEqual({ played: 2, wins: 1, losses: 1, draws: 0 });
    expect(recordMatch('tarneeb', 'draw')).toEqual({ played: 3, wins: 1, losses: 1, draws: 1 });
    expect(readStats('tarneeb')).toEqual({ played: 3, wins: 1, losses: 1, draws: 1 });
  });

  it('survives a corrupt stored value', () => {
    window.localStorage.setItem('sz-games-stats-tarneeb', '{not json');
    expect(readStats('tarneeb')).toEqual({ played: 0, wins: 0, losses: 0, draws: 0 });
  });
});

describe('without a browser', () => {
  it('reads as empty and swallows writes', () => {
    vi.unstubAllGlobals();
    expect(readRecord('2048')).toBe(0);
    expect(readStats('tarneeb')).toEqual({ played: 0, wins: 0, losses: 0, draws: 0 });
    expect(() => recordMatch('tarneeb', 'win')).not.toThrow();
  });
});
