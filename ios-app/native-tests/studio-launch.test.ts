import { expect, test } from 'bun:test';
import { parseFixtureLaunch } from './account-fixture-model';

const origin = 'https://127.0.0.1:9443', gate = 's'.repeat(64);
test('only the closed member Studio variant can request the pending-document preflight', () => {
  expect(parseFixtureLaunch(origin, `syrianzone://fixture/session?user=member&variant=transit-studio#${gate}`))
    .toEqual({ kind: 'session', user: 'member', variant: 'transit-studio', gate });
  expect(parseFixtureLaunch(origin, `syrianzone://fixture/session?user=member#${gate}`)).toEqual({ kind: 'session', user: 'member', gate });
  expect(parseFixtureLaunch(origin, `syrianzone://fixture/session?user=member&variant=popup-long#${gate}`))
    .toEqual({ kind: 'session', user: 'member', variant: 'popup-long', gate });
  for (const query of ['user=member&variant=studio', 'user=member&variant=', 'user=member&variant=transit-studio&variant=transit-studio',
    'user=member&variant=transit-studio&variant=popup-long', 'user=member&variant=transit-studio&extra=1',
    ...['admin', 'other', 'avatar', 'banned'].map(user => `user=${user}&variant=transit-studio`)])
    expect(() => parseFixtureLaunch(origin, `syrianzone://fixture/session?${query}#${gate}`)).toThrow();
  expect(() => parseFixtureLaunch(origin, 'syrianzone://fixture/cleanup?variant=transit-studio')).toThrow();
  expect(() => parseFixtureLaunch('https://syrian.zone', `syrianzone://fixture/session?user=member&variant=transit-studio#${gate}`)).toThrow();
});
