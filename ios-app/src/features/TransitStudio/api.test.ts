import { expect, test } from 'bun:test';
import { createApiClient } from '../../api';
import { createStudioClient } from './api';
import { emptyDraft } from './model';

const draft = { ...emptyDraft('damascus'), nameAr: 'مسار', segments: [[{ latitude: 33.5, longitude: 36.3 }, { latitude: 33.6, longitude: 36.4 }]] };
test('anonymous Studio submission omits account credentials and requires an actual pending ID', async () => {
  let authorization: string | null = 'unexpected';
  const api = createApiClient({ fetch: async (_url, options) => { authorization = new Headers(options?.headers).get('Authorization'); return Response.json({ id: 42, status: 'pending' }); } }); api.setAccessToken('existing-account');
  expect(await createStudioClient(api).save(draft)).toBe(42); expect(authorization).toBeNull();
  const invalid = createStudioClient(createApiClient({ fetch: async () => Response.json({ status: 'pending' }) }));
  await expect(invalid.save(draft)).rejects.toThrow();
});
test('linked edits require an authenticated origin and cannot dispatch under a newer account', async () => {
  let calls = 0;
  const api = createApiClient({ fetch: async () => { calls++; return Response.json({ id: 42, status: 'pending' }); } }), client = createStudioClient(api);
  await expect(client.save({ ...draft, editingRouteId: 'published' })).rejects.toThrow('الدخول');
  api.setAccessToken('A'); const generation = api.getSessionGeneration(); api.setAccessToken('B');
  await expect(client.save(draft, generation)).rejects.toThrow('الجلسة'); expect(calls).toBe(0);
});
