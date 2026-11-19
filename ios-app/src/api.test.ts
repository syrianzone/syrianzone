import { expect, test } from 'bun:test';
import { ApiError, createApiClient, type FetchImplementation } from './api';

const cities = [{ id: 'damascus', nameAr: 'دمشق', nameEn: 'Damascus', center: [36.3, 33.5], routeCount: 2, status: 'active' }];
const json = (payload: unknown, status = 200): Response => Response.json(payload, { status });

async function withinDeadline<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([request, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Request did not settle within 100 milliseconds')), 100);
    })]);
  } finally { clearTimeout(timer); }
}

test('uses current Flutter API paths and encodes search parameters', async () => {
  const requests: string[] = [];
  const client = createApiClient({ origin: 'https://api.example.test', fetch: async (input) => {
    requests.push(String(input));
    return requests.length === 1 ? json(cities) : json({ data: [], current_page: 1, last_page: 1, total: 0 });
  } });
  expect(await client.cities()).toHaveLength(1);
  await client.places({ query: 'دمشق & حلب', category: 'historical', sort: 'popular', page: 1 });
  expect(requests[0]).toBe('https://api.example.test/api/v1/transit/cities');
  const url = new URL(requests[1] ?? '');
  expect(url.pathname).toBe('/api/v1/places');
  expect(url.searchParams.get('q')).toBe('دمشق & حلب');
  expect(url.searchParams.get('category')).toBe('historical');
  expect(url.searchParams.get('sort')).toBe('popular');
});

test('rejects unsafe origins and invalid resource identifiers before fetching', async () => {
  let calls = 0;
  const client = createApiClient({ fetch: async () => { calls++; return json({}); } });
  expect(() => createApiClient({ origin: 'http://example.test' })).toThrow();
  expect(() => createApiClient({ origin: 'https://user:pass@example.test' })).toThrow();
  await expect(client.transitMap('../secret')).rejects.toThrow();
  await expect(client.place(-1)).rejects.toThrow();
  await expect(client.nearbyStops({ latitude: 100, longitude: 33 })).rejects.toThrow();
  expect(calls).toBe(0);
});

test('turns HTTP and malformed response failures into visible Arabic errors', async () => {
  const unavailable = createApiClient({ fetch: async () => json({ message: 'Internal Server Error' }, 503) });
  await expect(unavailable.cities()).rejects.toMatchObject({ status: 503, message: 'الخدمة غير متاحة الآن. حاول مرة أخرى.' });
  const malformed = createApiClient({ fetch: async () => json({ data: [] }) });
  await expect(malformed.cities()).rejects.toMatchObject({ code: 'invalid_response', message: 'أعاد الخادم بيانات غير صالحة.' });
  const html = createApiClient({ fetch: async () => new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } }) });
  await expect(html.cities()).rejects.toBeInstanceOf(ApiError);
});

test('never fetches a request that is already cancelled', async () => {
  let calls = 0;
  const controller = new AbortController();
  controller.abort();
  const client = createApiClient({ fetch: async () => { calls++; return json(cities); } });
  await expect(client.cities(controller.signal)).rejects.toMatchObject({ code: 'cancelled', message: 'تم إلغاء الطلب.' });
  expect(calls).toBe(0);
});

test('forwards cancellation and reports request timeouts separately', async () => {
  const pending: FetchImplementation = async (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  const client = createApiClient({ fetch: pending, timeoutMs: 5 });
  await expect(withinDeadline(client.cities())).rejects.toMatchObject({ code: 'timeout', message: 'انتهت مهلة الاتصال. حاول مرة أخرى.' });
  const controller = new AbortController();
  const result = client.cities(controller.signal);
  controller.abort();
  await expect(result).rejects.toMatchObject({ code: 'cancelled' });
});

test('reports connection failures without displaying transport internals', async () => {
  const client = createApiClient({ fetch: async () => { throw new Error('private endpoint detail'); } });
  await expect(client.cities()).rejects.toMatchObject({ code: 'network', message: 'تعذر الاتصال. تحقق من الإنترنت وحاول مرة أخرى.' });
});

test('reads the promises catalogue and details from the versioned API', async () => {
  const published = {
    number: 42, title: 'وعد حكومي', state: 'overdue', speaker: { name: 'المسؤول', title: null },
    coSpeakers: [], tags: [], statementDate: '2025-01-01', deadlineDate: '2025-02-01',
    counter: { mode: 'overdue', value: 5 },
  };
  const detail = {
    ...published, quote: 'نص الوعد', quoteIsVerbatim: true, statementVenue: 'speech', isNational: true,
    sources: [{ id: 1, type: 'news_article', url: 'http://example.test/news', archiveUrl: 'https://archive.example.test/news' }],
    updates: [{ id: 1, type: 'progress', happenedOn: '2025-02-05', sourceUrl: 'syrianzone://settings', archiveUrl: 'https://user@example.test' }],
    relatedPromises: [], votes: { yes: 5, no: 2 }, votingOpen: true,
  };
  const paths: string[] = [];
  const client = createApiClient({ fetch: async input => {
    const path = new URL(input).pathname;
    paths.push(path);
    return path === '/api/v1/promises' ? json({ promises: [published], stats: { total: 1, fulfilled: 0, overdue: 1 } })
      : json({ promise: detail });
  } });

  expect(await client.promises()).toMatchObject({ promises: [{ number: 42, state: 'overdue', counter: { mode: 'overdue', value: 5 } }] });
  expect(await client.promise(42)).toMatchObject({
    quote: 'نص الوعد', votes: { yes: 5, no: 2 },
    sources: [{ url: 'http://example.test/news', archiveUrl: 'https://archive.example.test/news' }],
    updates: [{ sourceUrl: null, archiveUrl: null }],
  });
  expect(paths).toEqual(['/api/v1/promises', '/api/v1/promises/42']);
  await expect(client.promise(1_000_000_000)).rejects.toMatchObject({ code: 'invalid_input' });
  await expect(client.promise(43)).rejects.toMatchObject({ code: 'invalid_response' });
});
