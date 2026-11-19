import { expect, test } from 'bun:test';
import { createApiClient } from '../api';
import { exchangeNativeGoogleSession } from './native-google-exchange';

test('native handoff exchange uses only the configured API and never attaches an existing bearer or changes that session', async () => {
  const sent: unknown[] = [];
  const client = createApiClient({ origin: 'https://local.invalid', fetch: async (url, init) => {
    sent.push({ url, bearer: new Headers(init?.headers).get('Authorization'), credentials: init?.credentials, body: JSON.parse(String(init?.body)) as unknown });
    return new Response(JSON.stringify({ token: '123|synthetic-local-token', token_type: 'Bearer', expires_at: null, user: { id: 101, name: 'محلي', email: 'member@native-fixture.invalid', role: 'user', effective_permissions: [], settings: {}, avatar_url: null, transit_scope: null } }), { headers: { 'Content-Type': 'application/json' } });
  } });
  client.setAccessToken('existing-session');
  const generation = client.getSessionGeneration();
  const body = { code: 'A'.repeat(43), code_verifier: 'a'.repeat(64), state: 'b'.repeat(64), device_name: 'Syrian Zone iOS' };
  expect((await exchangeNativeGoogleSession(client, body, new AbortController().signal)).user.id).toBe(101);
  expect(sent).toEqual([{ url: 'https://local.invalid/api/v1/auth/google/native/token', bearer: null, credentials: 'omit', body }]);
  expect(client.getSessionGeneration()).toBe(generation);
});
