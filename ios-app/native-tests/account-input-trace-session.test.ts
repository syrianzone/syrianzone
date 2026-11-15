import { expect, test } from 'bun:test';
import { prepareInputTrace } from './account-input-trace-session';

test('unsupported interception revokes only the verified fresh token before product adoption', async () => {
  const token = '71|synthetic_fresh_input_trace_only';
  const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
  const transport: typeof fetch = Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, ...(init ? { init } : {}) });
    return Object.defineProperty(Response.json({ ok: true }), 'url', { value: String(input) });
  }, { preconnect: fetch.preconnect });
  await expect(prepareInputTrace(Object.freeze({}), { origin: 'https://127.0.0.1:9443', user: 'admin', id: 103 }, token, transport)).rejects.toThrow('Input trace boundary rejected.');
  expect(calls).toHaveLength(1);
  expect(calls[0]!.input).toBe('https://127.0.0.1:9443/api/v1/auth/logout');
  expect(calls[0]!.init).toMatchObject({ method: 'POST', credentials: 'omit', redirect: 'error', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
  expect(calls[0]!.init?.signal).toBeInstanceOf(AbortSignal);
  await expect(prepareInputTrace({}, { origin: 'https://127.0.0.1:9443', user: 'admin', id: 103 }, 'bad', transport)).rejects.toThrow('Input trace fresh session rejected.');
  expect(calls).toHaveLength(1);
});
