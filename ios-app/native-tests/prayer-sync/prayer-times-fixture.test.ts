import { expect, test } from 'bun:test';
import { decodePrayerTimes } from '../../src/platform/prayer-model';
import { createPrayerTimesFixture, prayerTimesFixtureLabel, type PrayerTimesFixtureRead } from './prayer-times-fixture';

const origin = 'https://127.0.0.1:9443';
const current = () => new Date('2026-11-14T21:00:00.000Z');
const path = '/api/v1/prayer-times?governorate=damascus&method=3&date=2026-11-15';
const publicRead: RequestInit = { method: 'GET', credentials: 'omit', redirect: 'error',
  headers: { Accept: 'application/json', 'User-Agent': 'SyrianZone-iOS/0.1' } };
const clocks = { Fajr: '05:00', Sunrise: '06:15', Dhuhr: '12:00', Asr: '15:00', Maghrib: '18:00', Isha: '19:30' };

test('only the exact public local Damascus request receives explicitly synthetic clocks accepted by the real decoder', async () => {
  let delegated = 0;
  const reads: PrayerTimesFixtureRead[] = [];
  const transport = (async () => { delegated++; return new Response('passthrough'); }) as unknown as typeof fetch;
  const fixture = createPrayerTimesFixture(transport, value => { reads.push(value); }, current);
  const response = await fixture(origin + path, publicRead);
  expect(delegated).toBe(0); expect(response.status).toBe(200); expect(response.redirected).toBe(false);
  expect(response.url).toBe(origin + path); expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(response.headers.get('X-Native-Fixture')).toBe(prayerTimesFixtureLabel);
  const value: unknown = await response.json();
  expect(value).toHaveProperty('fixture', prayerTimesFixtureLabel);
  expect(decodePrayerTimes(value)).toEqual({ governorate: 'damascus', latitude: 33.5138, longitude: 36.2765,
    method: 3, date: '2026-11-15', timezone: 'Asia/Damascus', timings: clocks, hijri: null });
  expect(reads).toEqual([{ date: '2026-11-15', timezone: 'Asia/Damascus', governorate: 'damascus', method: 3 }]);
});

test('the eligible Request and URL forms preserve caller headers and use the actual Damascus day at each call', async () => {
  let now = new Date('2026-11-14T20:59:59.999Z'), delegated = 0;
  const fixture = createPrayerTimesFixture((async () => { delegated++; return new Response('pass'); }) as unknown as typeof fetch, undefined, () => now);
  const request = new Request(origin + path.replace('2026-11-15', '2026-11-14'), publicRead);
  expect((await (await fixture(request, publicRead)).json()).date).toBe('2026-11-14');
  expect(request.headers.get('User-Agent')).toBe('SyrianZone-iOS/0.1'); expect(request.bodyUsed).toBe(false);
  now = new Date('2026-11-14T21:00:00.000Z');
  const reordered = new URL(origin + '/api/v1/prayer-times?date=2026-11-15&method=3&governorate=damascus');
  expect((await (await fixture(reordered, publicRead)).json()).date).toBe('2026-11-15');
  expect(await (await fixture(request, publicRead)).text()).toBe('pass'); expect(delegated).toBe(1);
});

test('foreign origins, other paths, duplicate or extra query keys and any noncurrent or different location delegate unchanged', async () => {
  const inputs = [
    'http://127.0.0.1:9443' + path, 'https://localhost:9443' + path, 'https://127.0.0.1:9444' + path,
    'https://syrian.zone' + path, 'https://user@127.0.0.1:9443' + path, origin + path + '#fragment',
    origin + path.replace('/prayer-times?', '/prayer-times/?'), origin + path.replace('/api/v1/', '/api/'),
    origin + path.replace('/api/v1/', '/other/../api/v1/'), origin + path.replace('/api/v1/', '/other/%2e%2e/api/v1/'),
    origin + path.replace('damascus', 'aleppo'), origin + path.replace('method=3', 'method=5'),
    origin + path.replace('method=3', 'method=03'), origin + path.replace('2026-11-15', '2026-11-14'),
    origin + path.replace('2026-11-15', '2026-02-30'), origin + path + '&method=3',
    origin + path + '&extra=1', origin + path.replace('governorate=damascus', 'latitude=33.5138&longitude=36.2765'),
    origin + path.replace('&date=2026-11-15', ''), origin + '/api/v1/prayer-times', 'not an absolute URL'
  ];
  let delegated = 0, observed = 0;
  for (const input of inputs) {
    const expected = new Response('unchanged');
    const fixture = createPrayerTimesFixture((async (actual, init) => {
      expect(actual).toBe(input); expect(init).toBe(publicRead); delegated++; return expected;
    }) as typeof fetch, () => { observed++; }, current);
    expect(await fixture(input, publicRead)).toBe(expected);
  }
  expect(delegated).toBe(inputs.length); expect(observed).toBe(0);
});

test('authenticated, credentialled, mutating, redirected, aborted and non-JSON reads are never substituted', async () => {
  const aborted = new AbortController(); aborted.abort();
  const options: RequestInit[] = [
    { ...publicRead, method: 'POST', body: 'synthetic' }, { ...publicRead, method: 'HEAD' },
    { ...publicRead, body: 'synthetic' }, { ...publicRead, credentials: 'include' }, { ...publicRead, credentials: 'same-origin' },
    { ...publicRead, redirect: 'follow' }, { ...publicRead, redirect: 'manual' }, { ...publicRead, signal: aborted.signal },
    ...['Authorization', 'Cookie', 'X-Native-Fixture-Key', 'X-CSRF-TOKEN'].map(name => ({ ...publicRead,
      headers: { Accept: 'application/json', [name]: 'synthetic-private-marker' } })),
    { ...publicRead, headers: { Accept: 'text/html' } }, { method: 'GET', headers: { Accept: 'application/json' } }
  ];
  for (const init of options) {
    let observed = false;
    const response = new Response('unchanged');
    const fixture = createPrayerTimesFixture((async (input, actual) => {
      expect(input).toBe(origin + path); expect(actual).toBe(init); return response;
    }) as typeof fetch, () => { observed = true; }, current);
    expect(await fixture(origin + path, init)).toBe(response); expect(observed).toBe(false);
  }
});

test('Request options cannot hide a body or leak credentials through the synthetic read boundary', async () => {
  const requests = [new Request(origin + path, { method: 'POST', body: 'synthetic', headers: { Authorization: 'synthetic' } }),
    new Request(origin + path, { credentials: 'include', redirect: 'error', headers: { Accept: 'application/json' } })];
  for (const request of requests) {
    const expected = new Response('unchanged');
    const fixture = createPrayerTimesFixture((async (input, init) => {
      expect(input).toBe(request); expect(init).toBeUndefined(); return expected;
    }) as typeof fetch, undefined, current);
    expect(await fixture(request)).toBe(expected); expect(request.bodyUsed).toBe(false);
  }
});
