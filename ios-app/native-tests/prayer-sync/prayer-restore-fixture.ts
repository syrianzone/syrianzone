import type { PrayerFixtureLaunch } from './prayer-launch-model';
import type { createPrayerLocalJournal } from './prayer-local-journal';

// This cold entry must run before importing App, so no account-sync writer is mounted during cleanup.
export async function restorePrayerFixture(launch: Extract<PrayerFixtureLaunch, { kind: 'prayer-restore' }>, local: ReturnType<typeof createPrayerLocalJournal>, transport: typeof fetch) {
  const endpoint = 'https://127.0.0.1:9443/__native_fixture/prayer-sync';
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await transport(endpoint, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Native-Fixture-Key': launch.gate },
      credentials: 'omit', redirect: 'error', signal: controller.signal, body: JSON.stringify({ nonce: launch.run, day: launch.day, action: 'restore' }) });
    if (response.status !== 200 || response.redirected || response.url !== endpoint || !response.headers.get('Content-Type')?.includes('application/json')) throw new Error('The exact private Prayer rollback response was refused.');
    const raw = await response.text();
    if (raw.length > 2048) throw new Error('The private Prayer rollback response exceeded its bound.');
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The private Prayer rollback acknowledgement was refused.');
    const result = value as Record<string, unknown>;
    if (Object.keys(result).sort().join(',') !== 'closed,day,journalVersion,nonce,ok,pending,phase,restored'
      || result.journalVersion !== 2 || result.ok !== true || result.nonce !== launch.run || result.day !== launch.day || result.phase !== 0
      || result.pending !== null || result.restored !== true || result.closed !== false) throw new Error('The private Prayer rollback acknowledgement did not match the exact run.');
    const restored = await local.restore(launch.run, launch.day);
    if (restored.journalVersion !== 2) throw new Error('Matching local Prayer journal restoration is required.');
    return { journalVersion: 2 as const, nonce: launch.run, day: launch.day, restored: true as const, serverRestored: true as const };
  } finally { clearTimeout(timeout); }
}
