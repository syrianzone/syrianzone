export type PrayerFixtureLaunch =
  | { kind: 'session'; user: 'member' | 'other'; gate: string; variant: 'prayer-sync'; run: string; day: string }
  | { kind: 'prayer-restore'; gate: string; run: string; day: string };
const refused = (): never => { throw new Error('Local Prayer fixture launch rejected.'); };

export function parsePrayerFixtureLaunch(origin: string, input: string): PrayerFixtureLaunch | null {
  let url: URL;
  try { url = new URL(input); } catch { return null; }
  if (url.pathname !== '/prayer-sync-restore' && url.searchParams.get('variant') !== 'prayer-sync') return null;
  if (origin !== 'https://127.0.0.1:9443' || url.protocol !== 'syrianzone:' || url.hostname !== 'fixture'
    || url.port || url.username || url.password || input.split(/[?#]/, 1)[0] !== `syrianzone://fixture${url.pathname}`) return refused();
  const run = url.searchParams.get('run'), day = url.searchParams.get('day');
  let gate: string;
  try { gate = decodeURIComponent(url.hash.slice(1)); } catch { return refused(); }
  if (!run || !/^[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}$/.test(run)
    || !day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day
    || !/^[A-Za-z0-9_-]{16,256}$/.test(gate)) return refused();
  const keys = [...url.searchParams.keys()];
  if (url.pathname === '/prayer-sync-restore') {
    if (keys.length !== 2 || new Set(keys).size !== 2 || keys.some(key => !['run', 'day'].includes(key))) return refused();
    return { kind: 'prayer-restore', gate, run, day };
  }
  const user = url.searchParams.get('user');
  if (url.pathname !== '/session' || keys.length !== 4 || new Set(keys).size !== 4
    || keys.some(key => !['user', 'variant', 'run', 'day'].includes(key)) || (user !== 'member' && user !== 'other')) return refused();
  return { kind: 'session', user, gate, variant: 'prayer-sync', run, day };
}
