import { expect, test } from 'bun:test';
import { createApiClient } from '../api';

test('rejects a delayed authenticated action before it can use another account token', async () => {
  let calls = 0;
  const client = createApiClient({ fetch: async () => { calls++; return Response.json({ ok: true }); } });
  client.setAccessToken('A'); const generation = client.getSessionGeneration(); client.setAccessToken('B');
  await expect(client.request('board', value => value, { authenticated: true, sessionGeneration: generation, method: 'PUT', body: {} })).rejects.toMatchObject({ code: 'stale_session' });
  expect(calls).toBe(0);
});
test('does not decode an in-flight account A response after account B starts', async () => {
  let finish!: (response: Response) => void, decoded = false;
  const client = createApiClient({ fetch: () => new Promise(resolve => { finish = resolve; }) });
  client.setAccessToken('A');
  const request = client.request('user', value => { decoded = true; return value; }, { authenticated: true });
  client.setAccessToken('B'); finish(Response.json({ name: 'A' }));
  await expect(request).rejects.toMatchObject({ code: 'stale_session' }); expect(decoded).toBe(false);
});
