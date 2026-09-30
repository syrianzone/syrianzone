// Device-local records for the games hub. Guests and logged-in users share the
// same store: /games has no account sync, so nothing here leaves the browser.
// Keys are namespaced `sz-games-*` so the Muslim settings-sync engine (which
// only walks the `sz-muslim-*` family) never touches them.
//
// Two shapes of record live here. A run game keeps a single best number (2048's
// highest score, solitaire's shortest time); a match game keeps a win/loss
// tally (tarneeb). They are separate stores so neither has to know about the
// other, and a new game declares which shape it wants by which map it appears
// in.

const RECORD_PREFIX = 'sz-games-record-';
const MATCH_PREFIX = 'sz-games-stats-';

/** Games whose record is one best number. */
export const GAMES_RECORD_KEYS = {
  '2048': `${RECORD_PREFIX}2048-best`,
  solitare: `${RECORD_PREFIX}solitaire-best-time`,
} as const;

/** Games whose record is a win/loss tally. */
export const GAMES_MATCH_KEYS = {
  tarneeb: `${MATCH_PREFIX}tarneeb`,
} as const;

export type GameSlug = keyof typeof GAMES_RECORD_KEYS;
export type MatchSlug = keyof typeof GAMES_MATCH_KEYS;

/** 2048 wants the biggest score; solitaire wants the shortest time. */
export type Compare = 'higher' | 'lower';

export interface MatchStats {
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

const EMPTY_STATS: MatchStats = { played: 0, wins: 0, losses: 0, draws: 0 };

/** localStorage, or null where there is none (SSR, private mode that throws). */
function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function read(key: string): number {
  const value = Number(storage()?.getItem(key));
  return Number.isFinite(value) ? value : 0;
}

export function readRecord(slug: GameSlug): number {
  return read(GAMES_RECORD_KEYS[slug]);
}

/**
 * Store `value` when it beats the stored record. Returns the record to display
 * and whether this run set it, so the UI can say so. A `lower` record that
 * nothing has beaten yet reads as 0 — the caller decides what "unset" means.
 */
export function recordResult(
  slug: GameSlug,
  value: number,
  compare: Compare,
): { record: number; improved: boolean } {
  const current = read(GAMES_RECORD_KEYS[slug]);
  const unset = current === 0 && compare === 'lower';
  const improved = unset || (compare === 'higher' ? value > current : value < current);
  if (improved) {
    try {
      storage()?.setItem(GAMES_RECORD_KEYS[slug], String(value));
    } catch {
      // private mode: the run still counts for this session
    }
  }
  return { record: improved ? value : current, improved };
}

/** The win/loss tally for a match game, or an empty tally. */
export function readStats(slug: MatchSlug): MatchStats {
  const raw = storage()?.getItem(GAMES_MATCH_KEYS[slug]);
  if (!raw) return { ...EMPTY_STATS };
  try {
    const parsed = JSON.parse(raw) as Partial<MatchStats>;
    return {
      played: Number(parsed.played) || 0,
      wins: Number(parsed.wins) || 0,
      losses: Number(parsed.losses) || 0,
      draws: Number(parsed.draws) || 0,
    };
  } catch {
    return { ...EMPTY_STATS };
  }
}

/** Record one finished match and return the updated tally. */
export function recordMatch(slug: MatchSlug, result: 'win' | 'loss' | 'draw'): MatchStats {
  const next = readStats(slug);
  next.played += 1;
  if (result === 'win') next.wins += 1;
  else if (result === 'loss') next.losses += 1;
  else next.draws += 1;
  try {
    storage()?.setItem(GAMES_MATCH_KEYS[slug], JSON.stringify({ v: 1, ...next }));
  } catch {
    // private mode: the match still counts for this session
  }
  return next;
}
