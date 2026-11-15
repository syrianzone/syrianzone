import { expect, test } from 'bun:test';
import { parsePrayerFixtureLaunch } from './prayer-launch-model';

const origin = 'https://127.0.0.1:9443', run = 'ABCDEF00-0000-4000-8000-000000000099', day = '2026-11-15', gate = 'synthetic-fixture-key-0001';
const session = `syrianzone://fixture/session?user=member&variant=prayer-sync&run=${run}&day=${day}#${gate}`;
const restore = `syrianzone://fixture/prayer-sync-restore?run=${run}&day=${day}#${gate}`;
test('only the two canonical users may request the explicit nonce-bound Prayer session variant', () => {
  for (const user of ['member', 'other'] as const) expect(parsePrayerFixtureLaunch(origin, session.replace('user=member', `user=${user}`)))
    .toEqual({ kind: 'session', user, gate, variant: 'prayer-sync', run, day });
});
test('the exact cold local restore entry carries a gate and its one original run/day', () => {
  expect(parsePrayerFixtureLaunch(origin, restore)).toEqual({ kind: 'prayer-restore', gate, run, day });
});
test('other existing fixture routes remain delegated to the existing parser', () => {
  for (const input of [`syrianzone://fixture/session?user=member#${gate}`, `syrianzone://fixture/session?user=member&variant=popup-long#${gate}`,
    'syrianzone://fixture/cleanup']) expect(parsePrayerFixtureLaunch(origin, input)).toBeNull();
});
test('foreign origins, users, paths, extras, duplicate keys and invalid run/day/gate refuse', () => {
  for (const input of [session.replace('user=member', 'user=admin'), session.replace('user=member', 'user=avatar'),
    session.replace('syrianzone://fixture', 'https://fixture'), session.replace('://fixture', '://foreign'),
    session.replace('://fixture', '://user:pass@fixture'), session.replace('://fixture', '://fixture:44'),
    session.replace(`run=${run}`, `run=${run.toLowerCase()}`), session.replace(day, '2026-02-30'),
    session.replace(`&run=${run}`, ''), session.replace(`&day=${day}`, ''), session.replace(`#${gate}`, '#wrong'),
    session.replace(`#${gate}`, `&extra=1#${gate}`), session.replace(`#${gate}`, `&day=${day}#${gate}`),
    restore.replace(`#${gate}`, `&user=member#${gate}`), session.replace('/session', '/foreign/../session')]) expect(() => parsePrayerFixtureLaunch(origin, input)).toThrow();
  expect(() => parsePrayerFixtureLaunch('https://syrian.zone', session)).toThrow();
});
