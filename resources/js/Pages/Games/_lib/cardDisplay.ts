// A display preference shared by every card game: draw the full pip pattern, or
// one big rank with its suit under it — the "K Q J" treatment for every card,
// which is far easier to read on a small screen. Stored device-locally under
// the games namespace, like the scores, and read by each game on mount so the
// choice carries between solitaire and tarneeb.

const KEY = 'sz-games-card-large';

function store(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Whether cards should be drawn as one big rank instead of pips. */
export function readLargeCards(): boolean {
  try {
    return store()?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function writeLargeCards(large: boolean): void {
  try {
    store()?.setItem(KEY, large ? '1' : '0');
  } catch {
    // private mode: the choice just does not persist
  }
}
