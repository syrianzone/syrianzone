import { expect, test } from 'bun:test';
import { createDocumentStore } from '../src/platform/document-store';
import { prepareStudioPending, requireAbsentStudioPending, type StudioFixtureTransport } from './studio-fixture-model';

test('the Studio preflight accepts only missing or encoded-null documents without writing', async () => {
  for (const raw of [null, 'null', ' \nnull\t']) {
    const reads: string[] = [];
    expect(await requireAbsentStudioPending({ getItemAsync: async key => { reads.push(key); return raw; } })).toEqual({ pending: 'absent' });
    expect(reads).toEqual(['syrian-zone.document.transit-studio.pending.v1']);
  }
});

test('a real stored pending drawing is refused with its exact bytes and other documents unchanged', async () => {
  const rows = new Map<string, string>();
  const storage = { getItemAsync: async (key: string) => rows.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => { rows.set(key, value); } };
  const documents = createDocumentStore(storage);
  const pending = { version: 1, ownerId: 101, target: 'new:damascus', draft: { nameAr: 'existing private drawing', segments: [[{ latitude: 33.5, longitude: 36.2 }]] } };
  await documents.write('transit-studio.pending.v1', pending);
  await documents.write('unrelated-document', { unchanged: true });
  const before = [...rows.entries()];
  await expect(requireAbsentStudioPending(storage)).rejects.toThrow('refuses an existing pending document');
  expect([...rows.entries()]).toEqual(before);
  expect(await documents.read('transit-studio.pending.v1', value => value, null)).toEqual(pending);
});

test('malformed, scalar and oversized pending bytes fail closed and read errors propagate', async () => {
  for (const raw of ['', '{}', '[]', 'false', '0', '"null"', '{broken', '\uFEFFnull', '\u00A0null', 'null\u2028', 'x'.repeat(200_000)])
    await expect(requireAbsentStudioPending({ getItemAsync: async () => raw })).rejects.toThrow('refuses an existing pending document');
  const failure = new Error('test read failure');
  await expect(requireAbsentStudioPending({ getItemAsync: async () => { throw failure; } })).rejects.toBe(failure);
});

test('only a refused preflight revokes its own fresh session through the exact local logout contract', async () => {
  const token = `812|${'s'.repeat(40)}`, requests: { url: string; options?: RequestInit }[] = [];
  const transport: StudioFixtureTransport = async (input, options) => {
    requests.push({ url: String(input), ...(options ? { options } : {}) });
    const response = new Response(JSON.stringify({ ok: true }));
    Object.defineProperty(response, 'url', { value: 'https://127.0.0.1:9443/api/v1/auth/logout' });
    return response;
  };
  expect(await prepareStudioPending({ getItemAsync: async () => null }, token, transport)).toEqual({ pending: 'absent' });
  expect(requests).toEqual([]);
  await expect(prepareStudioPending({ getItemAsync: async () => '{private-existing}' }, token, transport)).rejects.toThrow('refuses an existing pending document');
  expect(requests).toHaveLength(1);
  expect(requests[0]?.url).toBe('https://127.0.0.1:9443/api/v1/auth/logout');
  expect(requests[0]?.options?.method).toBe('POST'); expect(requests[0]?.options?.credentials).toBe('omit'); expect(requests[0]?.options?.redirect).toBe('error');
  expect(new Headers(requests[0]?.options?.headers).get('Authorization')).toBe(`Bearer ${token}`);
  expect(new Headers(requests[0]?.options?.headers).has('X-Native-Fixture-Key')).toBe(false);
});

test('revocation fails closed on a wrong response identity or acknowledgement and never interpolates credentials into its error', async () => {
  const token = `812|${'s'.repeat(40)}`;
  for (const [status, url, result] of [[200, 'https://syrian.zone/api/v1/auth/logout', { ok: true }],
    [200, 'https://127.0.0.1:9443/api/v1/auth/logout', { message: 'ok' }], [500, 'https://127.0.0.1:9443/api/v1/auth/logout', { ok: true }]] as const) {
    const transport: StudioFixtureTransport = async () => {
      const response = new Response(JSON.stringify(result), { status }); Object.defineProperty(response, 'url', { value: url }); return response;
    };
    await expect(prepareStudioPending({ getItemAsync: async () => '{}' }, token, transport)).rejects.toThrow('Local Studio issued session cleanup failed.');
  }
  let read = false, sent = false;
  await expect(prepareStudioPending({ getItemAsync: async () => { read = true; return null; } }, 'invalid', async () => { sent = true; return new Response(); }))
    .rejects.toThrow('Local Studio issued session rejected.');
  expect(read).toBe(false); expect(sent).toBe(false);
});
