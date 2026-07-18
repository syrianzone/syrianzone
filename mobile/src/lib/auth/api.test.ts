import type { ApiClient, ApiRequestOptions } from '@/lib/api/client';

import { createAuthApi } from './api';

const user = {
  avatar_url: null,
  email: 'admin@example.test',
  id: 9,
  is_banned: false,
  name: 'Admin',
  role: 'admin',
};

interface ClientCall {
  options: ApiRequestOptions<unknown>;
  path: string;
}

function createClient() {
  const calls: ClientCall[] = [];
  const responses: unknown[] = [];
  const client: ApiClient = {
    async request<T>(path: string, options: ApiRequestOptions<T>): Promise<T> {
      calls.push({
        options: options as ApiRequestOptions<unknown>,
        path,
      });
      return options.schema.parse(responses.shift());
    },
  };

  return { calls, client, responses };
}

test('maps the one-time exchange to the backend contract', async () => {
  const { calls, client, responses } = createClient();
  const response = {
    expires_at: '2026-08-14T10:00:00Z',
    token: '9|plain-token',
    token_type: 'Bearer' as const,
    user,
  };
  responses.push(response);

  await expect(
    createAuthApi(client).exchange({
      code: 'one-time-code',
      codeVerifier: 'pkce-verifier',
      deviceName: 'syrianzone-ios',
    }),
  ).resolves.toEqual(response);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    options: {
      auth: false,
      body: {
        code: 'one-time-code',
        code_verifier: 'pkce-verifier',
        device_name: 'syrianzone-ios',
      },
      method: 'POST',
    },
    path: '/api/mobile/auth/exchange',
  });
});

test('hydrates the authenticated user from the bearer endpoint', async () => {
  const { calls, client, responses } = createClient();
  responses.push({ user });

  await expect(createAuthApi(client).getUser()).resolves.toEqual(user);
  expect(calls).toHaveLength(1);
  expect(calls[0]?.path).toBe('/api/mobile/user');
  expect(calls[0]?.options.method).toBeUndefined();
});

test('revokes the current bearer token through POST logout', async () => {
  const { calls, client, responses } = createClient();
  responses.push({ message: 'Logged out' });

  await expect(createAuthApi(client).logout()).resolves.toBeUndefined();
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    options: { method: 'POST' },
    path: '/api/mobile/logout',
  });
});

test('rejects a malformed exchange response before token storage can use it', async () => {
  const { client, responses } = createClient();
  responses.push({ token: 'missing-user-and-token-type' });

  await expect(
    createAuthApi(client).exchange({
      code: 'one-time-code',
      codeVerifier: 'pkce-verifier',
      deviceName: 'syrianzone-android',
    }),
  ).rejects.toBeTruthy();
});
