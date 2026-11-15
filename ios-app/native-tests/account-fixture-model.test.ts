import { expect, test } from 'bun:test';
import { assertFixtureScope, decodeFixtureSession, fixtureFetch, fixtureNavigationSubmission, fixtureUsers, parseFixtureLaunch, type FixtureUploadDiagnostic } from './account-fixture-model';
import { legacyPersistence } from '../src/platform/persistence-scope-model';

const origin = 'https://127.0.0.1:9443';
const gate = 'a'.repeat(64);
test('fixture navigation preserves the complete submitted native text and fresh sequence without dropping query mode', () => {
  for (const [index, destination] of ['promises?view=suggest', 'places?q=34.75%2C39&view=list', 'home'].entries()) {
    expect(fixtureNavigationSubmission(destination, index + 1)).toEqual({ destination, sequence: index + 1, url: `syrianzone://feature/${destination}` });
  }
  expect(fixtureNavigationSubmission('promises?view=suggest', 4).destination).not.toBe('promises?view=sugges');
});
test('fixture navigation rejects invalid destinations and invalid acknowledgement sequences before dispatch', () => {
  for (const text of ['', undefined, null, '/promises', 'https://syrian.zone/', 'Account', 'promises#fragment',
    'promises?view=suggest\n', 'promises?view=\u0000suggest', 'promises?' + 'a'.repeat(4097)]) {
    expect(() => fixtureNavigationSubmission(text, 1)).toThrow('Local fixture navigation rejected.');
  }
  for (const sequence of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    expect(() => fixtureNavigationSubmission('home', sequence)).toThrow('Local fixture navigation rejected.');
});
test('the closed fixture aliases include only the four baseline users and disposable avatar user 105', () => {
  expect(fixtureUsers).toEqual({ member: 101, other: 102, admin: 103, banned: 104, avatar: 105 });
  expect(parseFixtureLaunch(origin, `syrianzone://fixture/session?user=avatar#${gate}`)).toEqual({ kind: 'session', user: 'avatar', gate });
  for (const user of ['105', 'Avatar', 'avatar-admin', 'deleted', '__proto__'])
    expect(() => parseFixtureLaunch(origin, `syrianzone://fixture/session?user=${user}#${gate}`)).toThrow();
});
test('only the exact compiled loopback origin and bounded launch fragment may install a local session', () => {
  expect(parseFixtureLaunch(origin, `syrianzone://fixture/session?user=member#${gate}`)).toEqual({ kind: 'session', user: 'member', gate });
  expect(parseFixtureLaunch(origin, 'syrianzone://fixture/cleanup')).toEqual({ kind: 'cleanup' });
  for (const [compiled, launch] of [
    ['https://syrian.zone', `syrianzone://fixture/session?user=admin#${gate}`],
    [origin, `syrianzone://fixture/session?user=admin&redirect=https://syrian.zone#${gate}`],
    [origin, `syrianzone://fixture/session?user=admin&user=member#${gate}`],
    [origin, `syrianzone://fixture/session?user=owner#${gate}`],
    [origin, 'syrianzone://fixture/session?user=member#bad%0Dheader'],
    [origin, `syrianzone://fixture/cleanup#${gate}`],
    [origin, `https://fixture/session?user=member#${gate}`],
  ]) expect(() => parseFixtureLaunch(compiled ?? '', launch ?? '')).toThrow('Local fixture configuration rejected.');
});
test('the fixture blocks every other HTTP origin and redirected response before adopting credentials', async () => {
  const sent: string[] = [];
  const guarded = fixtureFetch(async input => { sent.push(String(input)); return new Response('{}'); });
  await guarded(`${origin}/api/v1/user`, { method: 'PATCH', redirect: 'follow' });
  for (const url of ['https://syrian.zone/api/v1/account', 'http://127.0.0.1:9443/', 'https://127.0.0.1:9444/', `${origin}/../@syrian.zone`]) {
    if (new URL(url).origin === origin) continue;
    await expect(guarded(url)).rejects.toThrow('Local fixture network boundary rejected.');
  }
  expect(sent).toEqual([`${origin}/api/v1/user`]);
  const redirect = fixtureFetch(async () => { const response = new Response('{}'); Object.defineProperty(response, 'redirected', { value: true }); return response; });
  await expect(redirect(`${origin}/api/v1/user`)).rejects.toThrow('Local fixture network boundary rejected.');
});
test('session decoding never accepts another origin or malformed credential', () => {
  expect(decodeFixtureSession({ origin, token: `123|sz_${'b'.repeat(40)}` })).toEqual({ origin, token: `123|sz_${'b'.repeat(40)}` });
  for (const value of [{ origin: 'https://syrian.zone', token: 'secret' }, { origin, token: '123|bad\r\nheader' }, { origin, token: '' }])
    expect(() => decodeFixtureSession(value)).toThrow('Local fixture session rejected.');
});
test('cleanup refuses canonical storage and accepts only a consistent full digest namespace', () => {
  const suffix = `.${'a'.repeat(64)}`;
  const scope = { origin, ...Object.fromEntries(Object.entries(legacyPersistence).map(([key, value]) => [key, value + suffix])) };
  expect(() => assertFixtureScope(scope)).not.toThrow();
  expect(() => assertFixtureScope({ origin, ...legacyPersistence })).toThrow();
  expect(() => assertFixtureScope({ ...scope, databaseName: `ExpoSQLiteStorage.${'b'.repeat(64)}` })).toThrow();
});
test('public Quran reads require explicit fixture opt-in and remain credential-free exact GET requests', async () => {
  const url = 'https://api-staging.mp3quran.net/v4/recitations/mahmoud-husary/r1/surahs/1/word-timings?include=text';
  const sent: RequestInit[] = [];
  const transport = async (_input: RequestInfo | URL, init?: RequestInit) => {
    sent.push(init ?? {});
    const response = new Response('{}');
    Object.defineProperty(response, 'url', { value: url });
    return response;
  };
  await expect(fixtureFetch(transport)(url)).rejects.toThrow('Local fixture network boundary rejected.');
  const read = fixtureFetch(transport, { publicQuranReads: true });
  await read(url, { headers: { Accept: 'application/json', 'User-Agent': 'SyrianZone-iOS/0.1' } });
  expect(sent).toHaveLength(1);
  expect(sent[0]?.credentials).toBe('omit');
  expect(sent[0]?.redirect).toBe('error');
  for (const options of [
    { method: 'POST' }, { method: 'PATCH' }, { body: 'private' }, { credentials: 'include' as const },
    { headers: { Authorization: 'Bearer private' } }, { headers: { cookie: 'private=1' } },
    { headers: { 'X-Native-Fixture-Key': gate } }, { headers: { 'Proxy-Authorization': 'private' } },
  ]) await expect(read(url, options)).rejects.toThrow('Local fixture network boundary rejected.');
  await expect(read(new Request(url, { headers: { Authorization: 'Bearer private' } }))).rejects.toThrow();
  for (const rejected of ['https://syrian.zone/api/v1/user/radio-usage', 'https://ipwho.is/', 'https://api-staging.mp3quran.net/admin',
    'https://api-staging.mp3quran.net/v4/surahs/115/text', url + '#fragment', url.replace('https:', 'http:')])
    await expect(read(rejected)).rejects.toThrow('Local fixture network boundary rejected.');
  expect(sent).toHaveLength(1);
});
test('public Quran opt-in rejects changed response URL, redirect and missing final URL without widening local mutations', async () => {
  const url = 'https://api-staging.mp3quran.net/v4/recitations/mahmoud-husary/r1/surahs/1';
  for (const [final, redirected] of [[url + '/ayah-timings', false], ['https://syrian.zone/', false], [url, true], ['', false]] as const) {
    const read = fixtureFetch(async () => {
      const response = new Response('{}');
      Object.defineProperties(response, { url: { value: final }, redirected: { value: redirected } });
      return response;
    }, { publicQuranReads: true });
    await expect(read(url)).rejects.toThrow('Local fixture network boundary rejected.');
  }
  let called = false;
  await fixtureFetch(async (_input, init) => { called = init?.method === 'POST'; return new Response('{}'); }, { publicQuranReads: true })(origin + '/api/v1/user/radio-usage', { method: 'POST' });
  expect(called).toBe(true);
});
test('opt-in upload observations retain only bounded part structure and response status while forwarding the original body', async () => {
  const events: FixtureUploadDiagnostic[] = [], privateValue = 'do-not-record-private-fixture-value';
  const body = { getParts: () => [
    { fieldName: 'name', string: privateValue, headers: { Authorization: privateValue } },
    { fieldName: 'photos[]', uri: `file:///private/${privateValue}.png`, name: privateValue, type: 'image/png' },
    ...Array.from({ length: 20 }, () => ({ fieldName: privateValue, string: privateValue })),
  ] } as unknown as BodyInit;
  let forwarded: BodyInit | null | undefined;
  const guarded = fixtureFetch(async (_input, init) => { forwarded = init?.body; return new Response('{}', { status: 201 }); }, { onUploadDiagnostic: value => events.push(value) });
  await guarded(origin + '/api/v1/places', { method: 'POST', body, headers: { Authorization: privateValue } });
  expect(forwarded).toBe(body);
  expect(events.map(value => value.phase)).toEqual(['request', 'response']);
  expect(events[0]?.body?.partCount).toBe(22);
  expect(events[0]?.body?.parts).toHaveLength(15);
  expect(events[0]?.body?.parts.slice(0, 2)).toEqual([
    { field: 'name', kind: 'text', hasUri: false, hasName: false, mime: 'missing' },
    { field: 'photos[]', kind: 'file', hasUri: true, hasName: true, mime: 'image/png' },
  ]);
  expect(events[1]?.status).toBe(201);
  expect(events[1]?.boundaryAccepted).toBe(true);
  expect(JSON.stringify(events)).not.toContain(privateValue);
  expect(JSON.stringify(events)).not.toContain('file:///');
  expect(JSON.stringify(events)).not.toContain('Authorization');
});
test('upload rejection reports only an allowed error class and numeric code and preserves the original rejection', async () => {
  const events: FixtureUploadDiagnostic[] = [];
  const error = Object.assign(new TypeError('private message file:///private/not-for-diagnostics'), { code: -1009 });
  const guarded = fixtureFetch(async () => { throw error; }, { onUploadDiagnostic: value => events.push(value) });
  await expect(guarded(origin + '/api/v1/places', { method: 'POST' })).rejects.toBe(error);
  expect(events.map(value => value.phase)).toEqual(['request', 'rejected']);
  expect(events[1]?.errorName).toBe('TypeError');
  expect(events[1]?.errorCode).toBe(-1009);
  expect(JSON.stringify(events)).not.toContain(error.message);
});
test('upload observations are restricted to the exact local places POST and cannot change transport behavior', async () => {
  const events: FixtureUploadDiagnostic[] = [];
  const guarded = fixtureFetch(async () => new Response('{}'), { onUploadDiagnostic: value => events.push(value) });
  for (const [path, method] of [['/api/v1/places', 'GET'], ['/api/v1/places?x=1', 'POST'], ['/api/v1/account/avatar', 'POST'], ['/api/v1/my/places/1/photos', 'POST']] as const)
    await guarded(origin + path, { method });
  expect(events).toEqual([]);
  await expect(guarded('https://syrian.zone/api/v1/places', { method: 'POST' })).rejects.toThrow('Local fixture network boundary rejected.');
  expect(events).toEqual([]);
  const observerFailure = fixtureFetch(async () => new Response('{}', { status: 202 }), { onUploadDiagnostic: () => { throw new Error('observer only'); } });
  expect((await observerFailure(origin + '/api/v1/places', { method: 'POST' })).status).toBe(202);
  const unreadable = Object.defineProperty({}, 'getParts', { get: () => { throw new Error('shape only'); } }) as BodyInit;
  expect((await guarded(origin + '/api/v1/places', { method: 'POST', body: unreadable })).status).toBe(200);
  expect(events[0]?.body?.kind).toBe('unreadable');
});
