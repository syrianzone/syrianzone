import { z } from 'zod';

import { createApiClient } from './client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

describe('api client', () => {
  test('joins the origin, query, token, and validated envelope', async () => {
    const fetchImplementation = jest.fn<
      Promise<Response>,
      [string, RequestInit?]
    >(async () =>
      jsonResponse({ data: { id: 7 } }),
    );
    const client = createApiClient({
      fetchImplementation,
      getAccessToken: async () => 'secret-token',
      origin: 'https://example.test/',
    });

    const result = await client.request('/api/mobile/user', {
      query: { page: 2, role: ['admin', 'user'] },
      schema: z.object({ data: z.object({ id: z.number() }) }),
    });

    expect(result.data.id).toBe(7);
    const [url, init] = fetchImplementation.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      'https://example.test/api/mobile/user?page=2&role=admin&role=user',
    );
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer secret-token',
    );
  });

  test('does not leak an HTML error body', async () => {
    const client = createApiClient({
      fetchImplementation: async () =>
        new Response('<h1>SQL failure</h1>', {
          headers: { 'content-type': 'text/html' },
          status: 500,
        }),
      origin: 'https://example.test',
    });

    await expect(
      client.request('/api/failure', { schema: z.unknown() }),
    ).rejects.toMatchObject({
      code: 'http_500',
      message: 'تعذر إكمال الطلب. حاول مرة أخرى.',
      status: 500,
    });
  });

  test('rejects a malformed success response', async () => {
    const client = createApiClient({
      fetchImplementation: async () => jsonResponse({ id: 'wrong' }),
      origin: 'https://example.test',
    });

    await expect(
      client.request('/api/value', {
        schema: z.object({ id: z.number() }),
      }),
    ).rejects.toMatchObject({
      code: 'invalid_response',
      status: 502,
    });
  });

  test('rejects paths outside the configured server origin', async () => {
    const client = createApiClient({ origin: 'https://example.test' });

    await expect(
      client.request('https://attacker.test/data', { schema: z.unknown() }),
    ).rejects.toMatchObject({ code: 'invalid_path' });
    await expect(
      client.request('//attacker.test/data', { schema: z.unknown() }),
    ).rejects.toMatchObject({ code: 'invalid_path' });
  });
});
