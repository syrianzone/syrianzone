import { expect, test } from 'bun:test';
import { createApiClient } from '../api';

test('preserves Arabic field validation and Retry-After without exposing framework internals', async () => {
  const client = createApiClient({ fetch: async () => Response.json({ message: 'Validation failed', errors: { name: ['اكتب الاسم'], 'photos.0': ['الصورة كبيرة'], email: ['Invalid field'] } }, { status: 422, headers: { 'Retry-After': '20' } }) });
  await expect(client.request('test', value => value)).rejects.toMatchObject({ status: 422, message: 'اكتب الاسم', fields: { name: ['اكتب الاسم'], photos: ['الصورة كبيرة'] }, retryAfter: 20 });
});
