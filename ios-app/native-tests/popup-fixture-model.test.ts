import { expect, test } from 'bun:test';
import { fixtureFetch, parseFixtureLaunch } from './account-fixture-model';

const origin = 'https://127.0.0.1:9443', gate = 'b'.repeat(64);
const title = 'صوتك بيعمل فرق: ساهم معنا لفتح الخدمات التقنية لأهل سوريا';
const description = 'ساهم في فك الحظر عن الخدمات التقنية في سوريا. شارك برأيك لتحديد الخدمات الأكثر أهمية للناس، وساعد في إيصال هذه الأولويات إلى الجهات المعنية بشكل واضح وموثّق.';
const page = { component: 'Home', version: 'actual-server-version', props: {
  sitePopup: { enabled: true, version: 9, title: 'عنوان', description: 'وصف', buttonText: 'افتح', dismissText: 'لاحقاً', link: 'https://example.invalid/original' },
  cities: [{ id: 'damascus', name: 'دمشق' }], anotherProp: { retained: true }
} };
function response(value: unknown = page, url = origin + '/', status = 200, type = 'application/json'): Response {
  const result = new Response(typeof value === 'string' ? value : JSON.stringify(value), {
    status, headers: { 'Content-Type': type, 'X-Inertia': 'true', ETag: 'original-body', 'Content-Length': '1024' }
  });
  Object.defineProperty(result, 'url', { value: url });
  return result;
}

test('only the closed member session variant enables long popup metadata', () => {
  expect(parseFixtureLaunch(origin, `syrianzone://fixture/session?user=member&variant=popup-long#${gate}`))
    .toEqual({ kind: 'session', user: 'member', gate, variant: 'popup-long' });
  expect(parseFixtureLaunch(origin, `syrianzone://fixture/session?user=member#${gate}`)).toEqual({ kind: 'session', user: 'member', gate });
  for (const query of [
    'user=member&variant=unknown', 'user=member&variant=', 'user=member&variant=popup-long&variant=popup-long',
    'user=member&variant=popup-long&user=member', 'user=member&variant=popup-long&extra=1',
    ...['admin', 'other', 'banned', 'avatar'].map(user => `user=${user}&variant=popup-long`)
  ]) expect(() => parseFixtureLaunch(origin, `syrianzone://fixture/session?${query}#${gate}`)).toThrow();
  expect(() => parseFixtureLaunch(origin, 'syrianzone://fixture/cleanup?variant=popup-long')).toThrow();
  expect(() => parseFixtureLaunch('https://syrian.zone', `syrianzone://fixture/session?user=member&variant=popup-long#${gate}`)).toThrow();
});

test('the opted-in exact public Home JSON changes only popup metadata after real transport verification', async () => {
  let overrides = 0;
  const original = response();
  const options = { publicQuranReads: false, popupVariant: 'popup-long' as const, onPopupOverride: () => { overrides++; } };
  const read = fixtureFetch(async () => original, options);
  const result = await read(origin + '/', { headers: { 'X-Inertia': 'true', Accept: 'application/json' } });
  const body = await result.json();
  expect(body.props.sitePopup.title).toBe(title);
  expect(body.props.sitePopup.description).toBe(description);
  expect(description.length).toBeGreaterThanOrEqual(150); expect(description.length).toBeLessThanOrEqual(180);
  expect(body.props.sitePopup).toEqual({ enabled: true, version: 1_900_000_157, title, description,
    buttonText: 'صوّت الآن', dismissText: 'لاحقاً', link: 'https://example.invalid/native-popup-layout' });
  expect(body).toEqual({ ...page, props: { ...page.props, sitePopup: body.props.sitePopup } });
  expect(await original.json()).toEqual(page);
  expect(result.url).toBe(origin + '/'); expect(result.status).toBe(200);
  expect(result.headers.get('cache-control')).toBe('no-store');
  expect(result.headers.has('content-length')).toBe(false); expect(result.headers.has('etag')).toBe(false);
  expect(overrides).toBe(1);
});

test('ordinary sessions, HTML bootstrap, other paths, authenticated reads and writes keep their original response', async () => {
  const original = response();
  expect(await fixtureFetch(async () => original)(origin + '/', { headers: { 'X-Inertia': 'true' } })).toBe(original);
  const options = { publicQuranReads: false, popupVariant: 'popup-long' as const };
  for (const [url, init, reply] of [
    [origin + '/', { headers: { Accept: 'text/html' } }, response('<html/>', origin + '/', 200, 'text/html')],
    [origin + '/?query=1', { headers: { 'X-Inertia': 'true' } }, response(page, origin + '/?query=1')],
    [origin + '/phonebook', { headers: { 'X-Inertia': 'true' } }, response(page, origin + '/phonebook')],
    [origin + '/', { method: 'POST', headers: { 'X-Inertia': 'true' } }, response()],
    [origin + '/', { headers: { 'X-Inertia': 'true', Authorization: 'Bearer test-only' } }, response()],
    [origin + '/', { headers: { 'X-Inertia': 'true', Cookie: 'test-only=1' } }, response()],
    [origin + '/', { headers: { 'X-Inertia': 'true', 'X-Native-Fixture-Key': gate } }, response()],
    [origin + '/', { headers: { 'X-Inertia': 'true' } }, response({}, origin + '/', 409)],
  ] satisfies [string, RequestInit, Response][]) {
    expect(await fixtureFetch(async () => reply, options)(url, init)).toBe(reply);
  }
});

test('the variant refuses unverified Home components, invalid public payloads and mismatched response paths', async () => {
  const options = { publicQuranReads: false, popupVariant: 'popup-long' as const };
  for (const reply of [
    response({ ...page, component: 'Phonebook/Index' }), response({ ...page, props: [] }),
    response({ ...page, props: { sitePopup: null } }), response(page, origin + '/another'), response(page, ''),
    response(page, 'https://syrian.zone/')
  ]) await expect(fixtureFetch(async () => reply, options)(origin + '/', { headers: { 'X-Inertia': 'true' } })).rejects.toThrow();
});
