import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ApiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

import { fetchWarnings, JARD_WARNINGS_URL } from './api';

const fixture = readFileSync(
  join(__dirname, '__fixtures__/jard-warnings.html'),
  'utf8',
);

const backendPayload = {
  fetched_at: '2026-09-02T20:00:00+00:00',
  items: [
    {
      description: 'Body',
      id: '1',
      link: 'https://example.test/1.xml',
      published_at: '2026-09-02T17:56:00+00:00',
      source: { color: '#ef4444', name: 'Feed', slug: 'feed' },
      title: 'Backend warning',
    },
  ],
  stale: true,
};

function clientWith(request: jest.Mock): ApiClient {
  return { request } as unknown as ApiClient;
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    headers: { 'content-type': 'text/html' },
    status,
  });
}

test('uses the backend warnings route first', async () => {
  const request = jest.fn(async (path: string, options: { auth?: boolean }) => {
    expect(path).toBe('/api/mobile/warnings');
    expect(options.auth).toBe(false);
    return { data: backendPayload };
  });
  const fetchImplementation = jest.fn();

  await expect(
    fetchWarnings(undefined, { client: clientWith(request), fetchImplementation }),
  ).resolves.toEqual(backendPayload);
  expect(fetchImplementation).not.toHaveBeenCalled();
});

test('falls back to the jard page when the backend answers 404', async () => {
  const request = jest.fn(async () => {
    throw new ApiError(404, 'http_404', 'Not found');
  });
  const fetchImplementation = jest.fn(async () => htmlResponse(fixture));

  const payload = await fetchWarnings(undefined, {
    client: clientWith(request),
    fetchImplementation,
    now: () => Date.parse('2026-09-02T20:00:00Z'),
  });

  expect(fetchImplementation).toHaveBeenCalledWith(
    JARD_WARNINGS_URL,
    expect.objectContaining({ headers: { Accept: 'text/html' } }),
  );
  expect(payload.stale).toBe(false);
  expect(payload.fetched_at).toBe('2026-09-02T20:00:00.000Z');
  expect(payload.items).toHaveLength(20);
  expect(payload.items[0]?.id).toBe('19901');
});

test('falls back to the jard page on a network error', async () => {
  const request = jest.fn(async () => {
    throw new ApiError(0, 'network', 'offline');
  });
  const fetchImplementation = jest.fn(async () => htmlResponse(fixture));

  await expect(
    fetchWarnings(undefined, { client: clientWith(request), fetchImplementation }),
  ).resolves.toMatchObject({ stale: false });
  expect(fetchImplementation).toHaveBeenCalledTimes(1);
});

test('rethrows other backend errors without falling back', async () => {
  const request = jest.fn(async () => {
    throw new ApiError(503, 'http_503', 'unavailable');
  });
  const fetchImplementation = jest.fn();

  await expect(
    fetchWarnings(undefined, { client: clientWith(request), fetchImplementation }),
  ).rejects.toMatchObject({ status: 503 });
  expect(fetchImplementation).not.toHaveBeenCalled();
});

test('reports a failed direct fetch instead of an empty list', async () => {
  const request = jest.fn(async () => {
    throw new ApiError(404, 'http_404', 'Not found');
  });
  const fetchImplementation = jest.fn(async () => htmlResponse('down', 500));

  await expect(
    fetchWarnings(undefined, { client: clientWith(request), fetchImplementation }),
  ).rejects.toThrow('Warnings request failed with status 500');
});
