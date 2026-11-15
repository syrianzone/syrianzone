import { expect, test } from 'bun:test';
import { createApiClient } from '../api';
import { requestSuperadminSession } from './mobile-login';

test('a rejected password login sends only submitted credentials and preserves an existing mobile session', async () => {
  const captured: { path: string; authorization: string | null; body: unknown }[] = [];
  const client = createApiClient({ origin: 'https://local.invalid', fetch: async (input, init) => {
    captured.push({ path: new URL(input).pathname, authorization: new Headers(init?.headers).get('Authorization'), body: init?.body ? JSON.parse(String(init.body)) as unknown : null });
    return input.endsWith('/auth/superadmin/token')
      ? new Response(JSON.stringify({ message: 'بيانات تسجيل الدخول غير صحيحة.' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
      : new Response('{}', { headers: { 'Content-Type': 'application/json' } });
  } });
  client.setAccessToken('prior-verified-session');
  const generation = client.getSessionGeneration();
  await expect(requestSuperadminSession(client, 'admin@localhost', ' literal password ')).rejects.toHaveProperty('status', 401);
  expect(client.getSessionGeneration()).toBe(generation);
  await client.request('user', value => value, { authenticated: true });
  expect(captured).toEqual([
    { path: '/api/v1/auth/superadmin/token', authorization: null, body: { email: 'admin@localhost', password: ' literal password ', device_name: 'Syrian Zone iOS' } },
    { path: '/api/v1/user', authorization: 'Bearer prior-verified-session', body: null },
  ]);
});
