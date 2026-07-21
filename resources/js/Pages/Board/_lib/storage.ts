import type { BoardDoc } from './types';

// `sz-` prefix matches every other preference key in the app (sz-theme,
// sz-language, sz-searchEngine).
export const DOC_KEY = 'sz-board:v1';
export const PREV_KEY = 'sz-board:v1:prev';
export const GEO_KEY = 'sz-board:geo';

// localStorage throws in private-mode and when storage is disabled entirely
// (see Lib/guessWhoSession.ts). The board must degrade to in-memory, never
// take the page down.
function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // quota or disabled storage: the in-memory document still works
  }
}

function readJson(key: string): unknown {
  const raw = safeGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function readLocal(): unknown {
  return readJson(DOC_KEY);
}

export function writeLocal(doc: BoardDoc): void {
  safeSet(DOC_KEY, JSON.stringify(doc));
}

// One geolocation fix shared by every widget that needs it, so the user is
// prompted once rather than once per tile.
export function readGeo(): { lat: number; lng: number } | null {
  const v = readJson(GEO_KEY) as { lat?: unknown; lng?: unknown } | null;
  if (!v || typeof v.lat !== 'number' || typeof v.lng !== 'number') return null;
  return { lat: v.lat, lng: v.lng };
}

export function writeGeo(coords: { lat: number; lng: number }): void {
  safeSet(GEO_KEY, JSON.stringify(coords));
}

// The losing side of a login merge, kept so the user can undo it for the
// session rather than silently losing a board.
export function readPrev(): unknown {
  return readJson(PREV_KEY);
}

export function writePrev(doc: BoardDoc): void {
  safeSet(PREV_KEY, JSON.stringify(doc));
}

export function clearPrev(): void {
  try {
    window.localStorage.removeItem(PREV_KEY);
  } catch {
    // nothing to do
  }
}
