import { expect, test } from 'bun:test';
import { createApiClient } from '../../api';
import { placesAdminApi } from './admin-api';

test('moderation uses canonical authenticated writes and stale confirmation cannot act for another account', async () => {
  const seen: { path: string; method: string; authorization: string | null; body: unknown }[] = [];
  const api = createApiClient({ fetch: async (url, options) => {
    seen.push({ path: new URL(url).pathname, method: options?.method ?? '', authorization: new Headers(options?.headers).get('Authorization'),
      body: options?.body ? JSON.parse(String(options.body)) : null });
    return Response.json(url.includes('place-reports') ? { id: 9, status: 'resolved' } : { id: 7, status: 'rejected' });
  } });
  api.setAccessToken('moderator-A');
  const actions = placesAdminApi(api.getSessionGeneration(), api);
  await actions.reject(7, '  أضف وصفاً أوضح  ');
  await actions.resolve(9, 'unpublish');
  expect(seen).toEqual([
    { path: '/api/v1/admin/places/7/reject', method: 'POST', authorization: 'Bearer moderator-A', body: { reason: 'أضف وصفاً أوضح' } },
    { path: '/api/v1/admin/place-reports/9/resolve', method: 'POST', authorization: 'Bearer moderator-A', body: { action: 'unpublish' } }
  ]);
  api.setAccessToken('moderator-B');
  await expect(actions.remove(7)).rejects.toThrow('الجلسة');
  expect(seen).toHaveLength(2);
});

test('wrong-resource and missing state acknowledgements never become moderation success', async () => {
  let payload: unknown = { id: 7, status: 'pending' };
  const api = createApiClient({ fetch: async () => Response.json(payload) });
  api.setAccessToken('moderator');
  const actions = placesAdminApi(api.getSessionGeneration(), api);
  await expect(actions.reject(7, '')).rejects.toThrow();
  payload = { id: 8, status: 'approved' };
  await expect(actions.approve(7)).rejects.toThrow();
  payload = {};
  await expect(actions.rotatePhoto(9)).rejects.toThrow();
});
