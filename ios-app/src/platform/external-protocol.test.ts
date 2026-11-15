import { expect, test } from 'bun:test';
import { createApiClient } from '../api';
import { externalReadUrl, acceptsExternalResponse } from './external-protocol';

test('only permits reviewed public data providers', () => {
  expect(externalReadUrl('https://ipwho.is/').hostname).toBe('ipwho.is');
  expect(externalReadUrl('https://api-staging.mp3quran.net/v4/surahs/114/text?riwayah=hafs_an_asim').pathname).toEndWith('/text');
  for (const value of ['https://example.com/', 'https://ipwho.is/secret', 'http://ipwho.is/', 'https://api-staging.mp3quran.net/v4/surahs/115/text']) expect(() => externalReadUrl(value)).toThrow();
  expect(acceptsExternalResponse(new URL('https://ipwho.is/'), 'https://evil.example/')).toBe(false);
});
test('public external reads omit account credentials and reject malformed JSON', async () => {
  const client = createApiClient({ fetch: async (_url, init) => {
    expect(new Headers(init?.headers).has('Authorization')).toBe(false);
    expect(init?.credentials).toBe('omit');
    return new Response('{bad', { headers: { 'content-type': 'application/json' } });
  } });
  client.setAccessToken('account-secret');
  await expect(client.externalJson('https://ipwho.is/', value => value)).rejects.toMatchObject({ code: 'invalid_response' });
  await expect(client.externalText('https://unknown.example/')).rejects.toMatchObject({ code: 'invalid_input' });
});
