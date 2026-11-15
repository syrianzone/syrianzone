import { expect, test } from 'bun:test';
import { createApiClient } from '../../api';
import { createDirectoryAdminClient } from './admin-api';
import { phonebookAdmin } from './admin-model';

test('directory mutations require canonical bearer-bound JSON acknowledgement and reject stale account dispatch', async () => {
  const seen: { path: string; method: string; bearer: string | null; body: unknown }[] = [];
  let acknowledge = true;
  const client = createApiClient({ fetch: async (url, init) => {
    seen.push({ path: new URL(url).pathname, method: init?.method ?? '', bearer: new Headers(init?.headers).get('Authorization'), body: init?.body ? JSON.parse(String(init.body)) : null });
    return Response.json({ success: acknowledge });
  } });
  client.setAccessToken('account-A');
  const actions = createDirectoryAdminClient(phonebookAdmin, client.getSessionGeneration(), client);
  await actions.save('items', null, { name_ar: 'رقم', number: '110', is_active: false });
  await actions.save('categories', 'emergency', { label_ar: 'طوارئ', label_en: 'Emergency' });
  expect(seen).toEqual([
    { path: '/api/v1/admin/phonebook/entries', method: 'POST', bearer: 'Bearer account-A', body: { name_ar: 'رقم', number: '110', is_active: false } },
    { path: '/api/v1/admin/phonebook/categories/emergency', method: 'PUT', bearer: 'Bearer account-A', body: { label_ar: 'طوارئ', label_en: 'Emergency' } }
  ]);
  acknowledge = false;
  await expect(actions.remove('items', 'one')).rejects.toThrow();
  client.setAccessToken('account-B');
  await expect(actions.toggle('one')).rejects.toThrow('الجلسة');
  expect(seen).toHaveLength(3);
});
