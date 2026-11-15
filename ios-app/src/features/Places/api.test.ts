import { expect, test } from 'bun:test';
import { createApiClient } from '../../api';
import { createPlacesClient } from './api';

test('account saves and reports use explicit session-bound canonical requests', async () => {
  const seen: { path: string; method: string; authorization: string | null; body: unknown }[] = [];
  const api = createApiClient({ fetch: async (url, options) => {
    seen.push({ path: new URL(url).pathname, method: options?.method ?? '', authorization: new Headers(options?.headers).get('Authorization'), body: options?.body ? JSON.parse(String(options.body)) : null });
    return Response.json(url.endsWith('/report') ? { message: 'تم استلام البلاغ' } : { saved: true, saves_count: 12 });
  } });
  api.setAccessToken('account-A');
  const generation = api.getSessionGeneration(), client = createPlacesClient(api);
  expect(await client.save(7, true, generation)).toEqual({ saved: true, count: 12 });
  expect(await client.report(7, 'wrong_info', 'تفاصيل', generation)).toBe('تم استلام البلاغ');
  expect(seen).toEqual([{ path: '/api/v1/places/7/save', method: 'POST', authorization: 'Bearer account-A', body: null }, { path: '/api/v1/places/7/report', method: 'POST', authorization: 'Bearer account-A', body: { reason: 'wrong_info', details: 'تفاصيل' } }]);
  api.setAccessToken('account-B');
  await expect(client.save(7, false, generation)).rejects.toThrow('الجلسة');
  expect(seen).toHaveLength(2);
});
test('owner location writes reject points outside Syria before any network call', async () => {
  let calls = 0;
  const api = createApiClient({ fetch: async () => { calls++; return Response.json({ id: 7, status: 'pending' }); } }); api.setAccessToken('account');
  const client = createPlacesClient(api);
  await expect(Promise.resolve().then(() => client.move(7, { latitude: 50, longitude: 36 }, api.getSessionGeneration()))).rejects.toThrow('سوريا');
  expect(calls).toBe(0);
});
test('missing save or submission acknowledgement never becomes native success', async () => {
  const api = createApiClient({ fetch: async () => Response.json({}) }); api.setAccessToken('account');
  const client = createPlacesClient(api);
  await expect(client.save(7, true, api.getSessionGeneration())).rejects.toThrow();
  await expect(client.resubmit(7, api.getSessionGeneration())).rejects.toThrow();
});
test('place multipart uses the shared image boundary in photo order and rejects a session changed during preparation', async () => {
  const images: { key: string; filename: string | null | undefined; maxBytes: number }[] = [];
  let calls = 0;
  const api = createApiClient({ fetch: async () => { calls += 1; return Response.json({ id: 7, status: 'pending' }); } }); api.setAccessToken('account-A');
  const photo = { uri: 'file:///tmp/p.jpg', name: 'p.jpg', mimeType: 'image/jpeg', size: 1024, width: 800, height: 600 };
  const input = { name: 'موقع', category: 'historical', description: 'وصف موثق للمكان الذي نريد زيارته', coordinate: { latitude: 34.7, longitude: 36.6 }, photos: [photo, { ...photo, name: 'second.jpg' }] };
  const client = createPlacesClient(api, async () => (_form, key, asset, bounds) => { images.push({ key, filename: asset.fileName, maxBytes: bounds.maxBytes }); });
  expect(await client.submit(input, api.getSessionGeneration())).toBe(7);
  expect(images).toEqual([{ key: 'photos[]', filename: 'p.jpg', maxBytes: 12 * 1024 * 1024 }, { key: 'photos[]', filename: 'second.jpg', maxBytes: 12 * 1024 * 1024 }]);
  const pending = client.submit(input, api.getSessionGeneration());
  api.setAccessToken('account-B');
  await expect(pending).rejects.toThrow('الجلسة');
  expect(calls).toBe(1);
});
