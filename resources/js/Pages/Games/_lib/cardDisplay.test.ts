import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readLargeCards, writeLargeCards } from './cardDisplay';

beforeEach(() => {
  const map = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => void map.delete(k),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('large-card preference', () => {
  it('defaults to pips', () => {
    expect(readLargeCards()).toBe(false);
  });

  it('round-trips the choice', () => {
    writeLargeCards(true);
    expect(readLargeCards()).toBe(true);
    writeLargeCards(false);
    expect(readLargeCards()).toBe(false);
  });

  it('reads as off with no browser', () => {
    vi.unstubAllGlobals();
    expect(readLargeCards()).toBe(false);
    expect(() => writeLargeCards(true)).not.toThrow();
  });
});
