import prayer from '../../../resources/data/prayer.json';
import { record } from './validation';

export const trackedPrayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export type TrackedPrayer = typeof trackedPrayers[number];
export type PrayerLog = Record<string, Partial<Record<TrackedPrayer, boolean>>>;
export interface FaithPreferences { method: number; methodChosen: boolean; prayerLog: PrayerLog; quranPage: number; quranPageAt: number }
export interface MethodConflict { local: number; account: number }
export const defaultFaithPreferences: FaithPreferences = { method: prayer.default_method, methodChosen: false, prayerLog: {}, quranPage: 1, quranPageAt: 0 };
const accepted = new Set([...prayer.methods.map(method => method.id), ...prayer.unlisted_method_ids]);
export function todayKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function prunePrayerLog(value: unknown): PrayerLog {
  if (value == null || (Array.isArray(value) && value.length === 0)) return {};
  const source = record(value), result: PrayerLog = {};
  for (const day of Object.keys(source).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key)).sort().slice(-31)) {
    const row = record(source[day]), entry: Partial<Record<TrackedPrayer, boolean>> = {};
    for (const key of trackedPrayers) if (typeof row[key] === 'boolean') entry[key] = row[key];
    result[day] = entry;
  }
  return result;
}
export function decodeFaithPreferences(value: unknown): FaithPreferences {
  const row = record(value);
  return { method: typeof row.method === 'number' && accepted.has(row.method) ? row.method : prayer.default_method,
    methodChosen: row.methodChosen === true, prayerLog: prunePrayerLog(row.prayerLog),
    quranPage: typeof row.quranPage === 'number' && Number.isInteger(row.quranPage) && row.quranPage >= 1 && row.quranPage <= 604 ? row.quranPage : 1,
    quranPageAt: typeof row.quranPageAt === 'number' && Number.isFinite(row.quranPageAt) && row.quranPageAt >= 0 ? row.quranPageAt : 0 };
}
export function mergeFaithPreferences(local: FaithPreferences, settings: Record<string, unknown>): {
  preferences: FaithPreferences; serverPatch: Record<string, unknown>; methodConflict: MethodConflict | null;
} {
  let preferences = { ...local };
  const serverPatch: Record<string, unknown> = {};
  let methodConflict: MethodConflict | null = null;
  const serverMethod = typeof settings.muslimMethod === 'number' && accepted.has(settings.muslimMethod) ? settings.muslimMethod : null;
  if (serverMethod !== null && !local.methodChosen) preferences = { ...preferences, method: serverMethod, methodChosen: true };
  else if (serverMethod !== null && serverMethod !== local.method) methodConflict = { local: local.method, account: serverMethod };
  else if (serverMethod === null && local.methodChosen) serverPatch.muslimMethod = local.method;
  const accountLog = prunePrayerLog(settings.prayerLog), merged: PrayerLog = {};
  for (const day of new Set([...Object.keys(local.prayerLog), ...Object.keys(accountLog)])) {
    const left = local.prayerLog[day] ?? {}, right = accountLog[day] ?? {}, row: Partial<Record<TrackedPrayer, boolean>> = {};
    for (const key of trackedPrayers) if (key in left || key in right) row[key] = Boolean(left[key] || right[key]);
    merged[day] = row;
  }
  preferences.prayerLog = prunePrayerLog(merged);
  if (JSON.stringify(preferences.prayerLog) !== JSON.stringify(accountLog)) serverPatch.prayerLog = preferences.prayerLog;
  const page = typeof settings.quranLastPage === 'number' && Number.isInteger(settings.quranLastPage) && settings.quranLastPage >= 1 && settings.quranLastPage <= 604 ? settings.quranLastPage : null;
  const accountAt = typeof settings.quranPageAt === 'number' && Number.isFinite(settings.quranPageAt) ? settings.quranPageAt * 1000 : 0;
  if (page !== null && accountAt >= local.quranPageAt) preferences = { ...preferences, quranPage: page, quranPageAt: accountAt };
  else if (local.quranPageAt > 0) { serverPatch.quranLastPage = local.quranPage; serverPatch.quranPageAt = Math.floor(local.quranPageAt / 1000); }
  return { preferences, serverPatch, methodConflict };
}

// PORT STATUS: source resources/js/Domain/settings/settingsSync.ts; confidence high; todos 0.
