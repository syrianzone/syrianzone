import { expect, test } from 'bun:test';
import { createApiClient } from '../api';

test('authenticated page reads attach Bearer only to the explicitly requested page', async () => {
  const calls: string[] = [];
  const client = createApiClient({ fetch: async (url, init) => {
    calls.push(url);
    if (new URL(url).pathname === '/') {
      expect(new Headers(init?.headers).has('Authorization')).toBe(false);
      return new Response('<div id="app" data-page="{&quot;component&quot;:&quot;Home&quot;,&quot;props&quot;:{},&quot;version&quot;:&quot;v1&quot;}"></div>');
    }
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer private');
    expect(init?.redirect).toBe('error');
    return Response.json({ component: 'Admin/Phonebook', props: { entries: [] } });
  } });
  client.setAccessToken('private');
  expect(await client.page('/admin/phonebook', 'Admin/Phonebook', value => value, { authenticated: true })).toEqual({ entries: [] });
  expect(calls).toHaveLength(2);
});
