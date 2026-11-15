import { decodeHomePreferences, defaultPreferences, type HomePreferences } from '../../src/features/Home/model';
import { hydrateHomePreferences } from '../../src/features/Home/hydrate';

export interface PrayerHomeContext {
  version: 2; home101: string; home102: string; appearance101: 'light' | 'dark'; appearance102: 'light' | 'dark'; seed102: boolean;
}
export type PrayerDigest = (value: string) => Promise<string>;
const fail = (): never => { throw new Error('The fixed Prayer Home context or native decoder roundtrip was refused.'); };
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  return value as Record<string, unknown>;
}
export function canonical(value: unknown): string {
  const sort = (item: unknown): unknown => Array.isArray(item) ? item.map(sort)
    : item && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, sort(child)])) : item;
  return JSON.stringify(sort(value));
}
export function decodePrayerHomeContext(value: unknown): PrayerHomeContext {
  const row = object(value);
  if (Object.keys(row).sort().join(',') !== 'appearance101,appearance102,home101,home102,seed102,version' || row.version !== 2
    || typeof row.home101 !== 'string' || !/^[a-f0-9]{64}$/.test(row.home101) || typeof row.home102 !== 'string' || !/^[a-f0-9]{64}$/.test(row.home102)
    || typeof row.appearance101 !== 'string' || !['light', 'dark'].includes(row.appearance101) || typeof row.appearance102 !== 'string' || !['light', 'dark'].includes(row.appearance102) || typeof row.seed102 !== 'boolean') fail();
  return row as unknown as PrayerHomeContext;
}
export async function homeHash(value: HomePreferences, hash: PrayerDigest): Promise<string> {
  const result = await hash(canonical(value));
  if (!/^[a-f0-9]{64}$/.test(result)) fail();
  return result;
}
export function localHome(raw: string | null): HomePreferences {
  if (raw !== null && raw.length > 50000) fail();
  return raw === null ? defaultPreferences : decodeHomePreferences(JSON.parse(raw));
}
export async function sourceHomeTransition(raw: string | null, settings: Record<string, unknown>, hash: PrayerDigest) {
  const local = localHome(raw);
  const resolved = await hydrateHomePreferences(local, settings, async () => {});
  const input = { ...local, ...settings };
  const vector = Object.fromEntries(['showWeather', 'showPrayerTimes', 'showEvents', 'eventsGovernorate', 'customLinks'].map(key => [key, input[key as keyof typeof input]]));
  if (canonical(vector) !== canonical(resolved.value)) fail();
  return { ...resolved, hash: await homeHash(resolved.value, hash) };
}
export async function canonicalOwnedHome(raw: string, allowed: readonly string[], hash: PrayerDigest): Promise<void> {
  const parsed: unknown = JSON.parse(raw), decoded = decodeHomePreferences(parsed);
  if (canonical(parsed) !== canonical(decoded) || !allowed.includes(await homeHash(decoded, hash))) fail();
}
