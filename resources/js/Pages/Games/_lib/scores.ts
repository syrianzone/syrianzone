// Device-local records for the games hub. Guests and logged-in users share the
// same store: /games has no account sync, so nothing here leaves the browser.
// Keys are namespaced `sz-games-*` so the Muslim settings-sync engine (which
// only walks the `sz-muslim-*` family) never touches them.

const PREFIX = 'sz-games-record-';

export const GAMES_RECORD_KEYS = {
  '2048': `${PREFIX}2048-best`,
  solitare: `${PREFIX}solitaire-best-time`,
} as const;

export type GameSlug = keyof typeof GAMES_RECORD_KEYS;

/** 2048 wants the biggest score; solitaire wants the shortest time. */
export type Compare = 'higher' | 'lower';

function read(key: string): number {
  if (typeof window === 'undefined') return 0;
  const n = Number(window.localStorage.getItem(key));
  return Number.isFinite(n) ? n : 0;
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
      window.localStorage.setItem(GAMES_RECORD_KEYS[slug], String(value));
    } catch {
      // private mode: the run still counts for this session
    }
  }
  return { record: improved ? value : current, improved };
}
