// Local persistence + optional account sync for the compass.
// Progress and results are stored locally always; logged-in users also sync to the account.
import type { AnswerMap, CompassResult, QuizVersion } from '../data/types';

const KEY_PROGRESS = 'sz-compass-v2-progress';
const KEY_RESULTS = 'sz-compass-v2-results';
const KEY_LAST = 'sz-compass-v2-last'; // last completed result id (local)

export interface Progress {
  version: QuizVersion;
  answers: AnswerMap;
  index: number;
  updatedAt: string;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ---- progress ----
export function loadProgress(): Progress | null {
  if (typeof window === 'undefined') return null;
  return safeParse<Progress | null>(localStorage.getItem(KEY_PROGRESS), null);
}
export function saveProgress(p: Progress) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY_PROGRESS, JSON.stringify(p));
  } catch {}
}
export function clearProgress() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY_PROGRESS);
  } catch {}
}

// ---- results ----
export function loadResults(): CompassResult[] {
  if (typeof window === 'undefined') return [];
  return safeParse<CompassResult[]>(localStorage.getItem(KEY_RESULTS), []);
}
export function addResult(r: CompassResult) {
  if (typeof window === 'undefined') return;
  const all = loadResults();
  all.unshift(r);
  try {
    localStorage.setItem(KEY_RESULTS, JSON.stringify(all.slice(0, 50)));
  } catch {}
}
export function setLastResultId(id: string | number) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY_LAST, String(id));
  } catch {}
}
export function getLastResultId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(KEY_LAST);
  } catch {
    return null;
  }
}
export function clearLocal() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY_PROGRESS);
    localStorage.removeItem(KEY_RESULTS);
    localStorage.removeItem(KEY_LAST);
  } catch {}
}

// ---- account sync ----
export async function fetchAccountResults(): Promise<CompassResult[]> {
  const res = await fetch('/api/v1/compass/results', {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const json = await res.json();
  return (json.data ?? json) as CompassResult[];
}

export async function saveResultToAccount(result: CompassResult): Promise<CompassResult | null> {
  const res = await fetch('/api/v1/compass/results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(result),
  });
  if (!res.ok) throw new Error(`save failed: ${res.status}`);
  const json = await res.json();
  return (json.data ?? json) as CompassResult;
}

export async function deleteAccountResults(): Promise<void> {
  const res = await fetch('/api/v1/compass/results', {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error(`delete failed: ${res.status}`);
}

export async function deleteAccountResult(id: number | string): Promise<void> {
  const res = await fetch(`/api/v1/compass/results/${id}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error(`delete failed: ${res.status}`);
}

/** Submit a run anonymously for statistics (works for guests and users).
 *  Returns an opaque delete token for opting back out. */
export async function submitStats(result: CompassResult): Promise<string | null> {
  const res = await fetch('/api/v1/compass/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(result),
  });
  if (!res.ok) throw new Error(`stats failed: ${res.status}`);
  const json = await res.json();
  return json.token ?? null;
}

/** Remove an anonymous stats row via its token. */
export async function removeStats(token: string): Promise<void> {
  const res = await fetch('/api/v1/compass/stats', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error(`stats delete failed: ${res.status}`);
}

// ---- share (account-independent) ----
export async function shareResult(payload: { version: QuizVersion; answers: AnswerMap }): Promise<string> {
  const res = await fetch('/api/v1/compass/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`share failed: ${res.status}`);
  const json = await res.json();
  return json.share_id as string;
}
