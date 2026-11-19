// Local persistence + optional account sync for the compass.
// Progress and results are stored locally always; logged-in users also sync to the account.
import { api as client, API_V1 } from '@/Lib/api';
import type { AnswerMap, CompassResult, QuizVersion } from '@/Domain/compass/types';

const KEY_PROGRESS = 'sz-compass-v2-progress';
const KEY_RESULTS = 'sz-compass-v2-results';
const KEY_PENDING_SAVE = 'sz-compass-v2-pending-save';
let pendingSaveActive = false;
let pendingSaveRevision = 0;

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
export function clearLocal() {
  if (typeof window === 'undefined') return;
  try {
    removePendingResult();
    localStorage.removeItem(KEY_PROGRESS);
    localStorage.removeItem(KEY_RESULTS);
  } catch {}
}

/** Patch a single stored local result in place (by id), without adding a row. */
export function updateLocalResult(
  id: string | number | undefined | null,
  patch: Partial<CompassResult>
): void {
  if (typeof window === 'undefined' || id == null) return;
  const all = loadResults();
  let changed = false;
  const next = all.map((r) => {
    if (String(r.id) !== String(id)) return r;
    changed = true;
    return { ...r, ...patch };
  });
  if (!changed) return;
  try {
    localStorage.setItem(KEY_RESULTS, JSON.stringify(next));
  } catch {}
}

/** Delete one stored local result (by id) and return what remains, or `null`
 *  when the browser refused the write (so the caller can report it). */
export function removeLocalResult(id: string | number | undefined | null): CompassResult[] | null {
  const all = loadResults();
  if (typeof window === 'undefined' || id == null) return all;
  const kept = all.filter((r) => String(r.id) !== String(id));
  try {
    removePendingResult(id);
    localStorage.setItem(KEY_RESULTS, JSON.stringify(kept));
  } catch {
    return null;
  }
  return kept;
}

function removePendingResult(id?: string | number | null): void {
  const pending = safeParse<{ id?: string | number } | null>(localStorage.getItem(KEY_PENDING_SAVE), null);
  if (id == null || (pending && String(pending.id) === String(id))) {
    localStorage.removeItem(KEY_PENDING_SAVE);
    pendingSaveRevision++;
  }
}

/** Queue a completed result to be saved to the account once the user is
 *  logged in. Called right before redirecting to the login provider. */
export function setPendingAccountSave(result: CompassResult) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY_PENDING_SAVE, JSON.stringify(result));
    pendingSaveRevision++;
  } catch {}
}

function readPendingSave(): string | null {
  try {
    return localStorage.getItem(KEY_PENDING_SAVE);
  } catch {
    return null;
  }
}

export async function fetchAccountResults(): Promise<CompassResult[]> {
  const json = await client.get<{ data?: CompassResult[] } | CompassResult[]>(`${API_V1}/compass/results`);
  return Array.isArray(json) ? json : (json.data ?? []);
}

export async function saveResultToAccount(result: CompassResult): Promise<CompassResult | null> {
  type SavedBody = { data?: CompassResult };
  const json = await client.post<CompassResult | SavedBody>(`${API_V1}/compass/results`, result);
  return 'version' in json ? json : (json.data ?? null);
}

export async function savePendingResultToAccount(): Promise<boolean> {
  if (typeof window === 'undefined' || pendingSaveActive) return false;
  pendingSaveActive = true;
  try {
    const locks = globalThis.navigator?.locks;
    if (locks) return await locks.request(KEY_PENDING_SAVE, { ifAvailable: true }, lock => lock ? uploadPendingSave() : false);
    return await uploadPendingSave();
  } finally {
    pendingSaveActive = false;
  }
}

async function uploadPendingSave(): Promise<boolean> {
  // Keep the payload in storage so rejection needs no write and cannot undo deletion.
  const queued = readPendingSave();
  const result = safeParse<CompassResult | { attempt: string } | null>(queued, null);
  if (!result || typeof result !== 'object' || 'attempt' in result) return false;
  const revision = pendingSaveRevision;
  const isCurrent = () => revision === pendingSaveRevision && readPendingSave() === queued;
  let saved: CompassResult | null;
  try {
    saved = await saveResultToAccount(result);
  } catch (error) {
    if (isCurrent()) throw error;
    return false;
  }
  if (!isCurrent()) return false;
  localStorage.removeItem(KEY_PENDING_SAVE);
  updateLocalResult(result.id, { id: saved?.id ?? result.id, savedToAccount: true });
  return true;
}

export function deleteAccountResults(): Promise<void> {
  return client.delete(`${API_V1}/compass/results`);
}

export function deleteAccountResult(id: number | string): Promise<void> {
  return client.delete(`${API_V1}/compass/results/${id}`);
}

/** Submit a run anonymously for statistics (works for guests and users).
 *  Returns an opaque delete token for opting back out. */
export async function submitStats(result: CompassResult): Promise<string | null> {
  const json = await client.post<{ token?: string | null }>(`${API_V1}/compass/stats`, result);
  return json.token ?? null;
}

export function removeStats(token: string): Promise<void> {
  return client.delete(`${API_V1}/compass/stats`, { token });
}
