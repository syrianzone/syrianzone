import type { createPrayerLocalJournal } from './prayer-local-journal';
import type { PrayerFixtureLaunch } from './prayer-launch-model';
import { decodePrayerHomeContext, object } from './prayer-home-context';

export async function preparePrayerSession(openLocal: () => Promise<ReturnType<typeof createPrayerLocalJournal>>, launch: Extract<PrayerFixtureLaunch, { kind: 'session' }>,
  issuedToken: string, transport: typeof fetch, verifiedProfile: unknown) {
  if (!/^\d+\|[A-Za-z0-9_-]{16,256}$/.test(issuedToken)) throw new Error('Local Prayer issued session rejected.');
  try {
    const profile = object(verifiedProfile), userId = launch.user === 'member' ? 101 : 102;
    if (profile.id !== userId) throw new Error('The exact verified local Prayer profile is required.');
    const settings = profile.settings == null || Array.isArray(profile.settings) && profile.settings.length === 0 ? {} : object(profile.settings);
    const endpoint = 'https://127.0.0.1:9443/__native_fixture/prayer-sync';
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    let context, phase, pending;
    try {
      const response = await transport(endpoint, { method: 'POST', credentials: 'omit', redirect: 'error', signal: controller.signal,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Native-Fixture-Key': launch.gate },
        body: JSON.stringify({ nonce: launch.run, day: launch.day, action: 'context' }) });
      if (response.status !== 200 || response.redirected || response.url !== endpoint || !response.headers.get('Content-Type')?.includes('application/json')) throw new Error('The closed Prayer context response was refused.');
      const raw = await response.text();
      if (raw.length > 2048) throw new Error('The closed Prayer context response exceeded its bound.');
      const value = object(JSON.parse(raw));
      if (Object.keys(value).sort().join(',') !== 'closed,context,day,journalVersion,nonce,ok,pending,phase,restored'
        || value.journalVersion !== 2 || value.ok !== true || value.nonce !== launch.run || value.day !== launch.day
        || value.restored !== false || value.closed !== false || !Number.isInteger(value.phase) || Number(value.phase) < 0 || Number(value.phase) > 5
        || !(value.pending === null || Number.isInteger(value.pending) && Number(value.pending) >= 1 && Number(value.pending) <= 5)) throw new Error('The armed immutable Prayer context did not match this run.');
      context = decodePrayerHomeContext(value.context); phase = Number(value.phase); pending = value.pending === null ? null : Number(value.pending);
    } finally { clearTimeout(timeout); }
    const local = await openLocal();
    const prepared = await local.prepare(launch.run, launch.day, context, { userId, settings, phase, pending });
    if (prepared.journalVersion !== 2) throw new Error('Matching local Prayer journal version is required before App import.');
    return prepared;
  } catch (reason) {
    const url = 'https://127.0.0.1:9443/api/v1/auth/logout';
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    try {
      // The fresh verified token is still uninstalled and App has not been imported.
      const response = await transport(url, { method: 'POST', credentials: 'omit', redirect: 'error', signal: controller.signal,
        headers: { Accept: 'application/json', Authorization: `Bearer ${issuedToken}` } });
      const result: unknown = await response.json();
      if (response.status !== 200 || response.redirected || response.url !== url || !result || typeof result !== 'object' || !('ok' in result) || result.ok !== true)
        throw new Error('The fresh local Prayer session could not be revoked.');
    } catch { throw new Error('The fresh local Prayer session could not be revoked.'); }
    finally { clearTimeout(timeout); }
    throw reason;
  }
}
