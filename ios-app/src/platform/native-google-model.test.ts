import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { nativeGoogleCallback, parseNativeGoogleCallback, runNativeGoogleSignIn, type NativeGooglePorts } from './native-google-model';
import config from '../../app.config';

const state = 'b'.repeat(64), code = 'A'.repeat(43);
const session = { token: 'synthetic-mobile-token', user: { id: 101, name: 'محلي', email: 'member@native-fixture.invalid', role: 'user', effective_permissions: [], settings: {}, avatar_url: null, transit_scope: null }, expiresAt: null };
const callback = (query: string) => `${nativeGoogleCallback}?${query}`;
test('the default native build registers the broker callback scheme without a Google iOS client', () => {
  const schemes = typeof config.scheme === 'string' ? [config.scheme] : config.scheme ?? [];
  expect(schemes).toContain(nativeGoogleCallback.split(':')[0] ?? 'missing');
  expect(schemes).toContain('syrianzone');
});
function setup(overrides: Partial<NativeGooglePorts> = {}) {
  const calls: { browser: string[]; dismissed: number; exchanges: unknown[]; random: number[] } = { browser: [], dismissed: 0, exchanges: [], random: [] };
  let randomIndex = 0;
  const ports: NativeGooglePorts = {
    origin: 'https://local.invalid',
    randomBytes: async count => { calls.random.push(count); return new Uint8Array(count).fill(++randomIndex); },
    sha256Base64: async value => createHash('sha256').update(value).digest('base64'),
    openBrowser: async url => { calls.browser.push(url); return { type: 'success', url: callback(`code=${code}&state=${new URL(url).searchParams.get('state')}`) }; },
    dismissBrowser: () => { calls.dismissed++; },
    exchange: async body => { calls.exchanges.push(body); return session; },
    ...overrides,
  };
  return { ports, calls };
}
test('native creates independent32byte secrets and sends only S256 challenge/state through the browser', async () => {
  const { ports, calls } = setup();
  expect(await runNativeGoogleSignIn(ports, new AbortController().signal, () => true)).toBe(session);
  expect(calls.random).toEqual([32, 32]);
  const verifier = '01'.repeat(32), nativeState = '02'.repeat(32);
  const url = new URL(calls.browser[0] ?? '');
  expect(url.origin + url.pathname).toBe('https://local.invalid/auth/google/native');
  expect(Object.fromEntries(url.searchParams)).toEqual({ code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', state: nativeState });
  expect(url.toString()).not.toContain(verifier);
  expect(calls.exchanges).toEqual([{ code, code_verifier: verifier, state: nativeState, device_name: 'Syrian Zone iOS' }]);
});
test('callback accepts only exact reverse-domain URI, unique known parameters, canonical code and original client state', () => {
  expect(parseNativeGoogleCallback(callback(`code=${code}&state=${state}`), state)).toEqual({ code });
  for (const invalid of [
    `syrianzone://auth/callback?code=${code}&state=${state}`,
    `zone.syrian.ios://oauth/google?code=${code}&state=${state}`,
    `zone.syrian.ios:/oauth/google/?code=${code}&state=${state}`,
    callback(`code=${code}&state=${state}#extra`),
    callback(`code=${code}&state=${state}#`),
    callback(`code=${code}&state=${state.slice(0, 10)}\n${state.slice(10)}`),
    callback(`code=${code}&state=${state}&code=${code}`),
    callback(`code=${code}&state=${state}&state=${state}`),
    callback(`code=${code}&state=${state}&access_token=never-accepted`),
    callback(`code=${code}&state=${'c'.repeat(64)}`),
    callback(`code=${'B'.repeat(43)}&state=${state}`),
    callback(`error=auth_failed&code=${code}&state=${state}`),
    callback(`error=untrusted&state=${state}`),
    'https://foreign.invalid/callback',
  ]) expect(() => parseNativeGoogleCallback(invalid, state)).toThrow();
  expect(parseNativeGoogleCallback(callback(`error=banned&state=${state}`), state)).toEqual({ error: 'banned' });
});
test('provider failures and browser cancellation never exchange or adopt a token', async () => {
  for (const type of ['cancel', 'dismiss']) {
    const { ports, calls } = setup({ openBrowser: async () => ({ type }) });
    expect(await runNativeGoogleSignIn(ports, new AbortController().signal, () => true)).toBeNull();
    expect(calls.exchanges).toEqual([]);
  }
  for (const error of ['auth_failed', 'auth_expired', 'banned', 'unverified_email']) {
    const { ports, calls } = setup({ openBrowser: async url => ({ type: 'success', url: callback(`error=${error}&state=${new URL(url).searchParams.get('state')}`) }) });
    await expect(runNativeGoogleSignIn(ports, new AbortController().signal, () => true)).rejects.toThrow(/[\u0600-\u06ff]/);
    expect(calls.exchanges).toEqual([]);
  }
});
test('abort during browser dismisses only that owned session and ignores a late callback', async () => {
  const controller = new AbortController();
  let complete!: (value: { type: string; url: string }) => void;
  const browser = new Promise<{ type: string; url: string }>(resolve => { complete = resolve; });
  const { ports, calls } = setup({ openBrowser: url => { calls.browser.push(url); return browser; } });
  const result = runNativeGoogleSignIn(ports, controller.signal, () => true);
  for (let i = 0; i < 8 && !calls.browser.length; i++) await Promise.resolve();
  expect(calls.browser.length).toBe(1);
  controller.abort();
  expect(await result).toBeNull();
  expect(calls.dismissed).toBe(1);
  complete({ type: 'success', url: callback(`code=${code}&state=${state}`) });
  await Promise.resolve();
  expect(calls.exchanges).toEqual([]);
});
test('stale epochs before browser or after exchange cannot return an adoptable session', async () => {
  let current = true;
  const before = setup({ sha256Base64: async () => { current = false; return 'A'.repeat(43) + '='; } });
  expect(await runNativeGoogleSignIn(before.ports, new AbortController().signal, () => current)).toBeNull();
  expect(before.calls.browser).toEqual([]);
  current = true;
  const after = setup({ exchange: async () => { current = false; return session; } });
  expect(await runNativeGoogleSignIn(after.ports, new AbortController().signal, () => current)).toBeNull();
});
test('a session change while the browser is open prevents exchange even without an explicit abort', async () => {
  let current = true;
  const { ports, calls } = setup({ openBrowser: async url => {
    current = false;
    return { type: 'success', url: callback(`code=${code}&state=${new URL(url).searchParams.get('state')}`) };
  } });
  expect(await runNativeGoogleSignIn(ports, new AbortController().signal, () => current)).toBeNull();
  expect(calls.exchanges).toEqual([]);
});
test('abort during an in-flight exchange cannot return a late token or dismiss a later browser', async () => {
  const controller = new AbortController();
  let complete!: (value: typeof session) => void, dispatched = false;
  const pending = new Promise<typeof session>(resolve => { complete = resolve; });
  const { ports, calls } = setup({ exchange: () => { dispatched = true; return pending; } });
  const result = runNativeGoogleSignIn(ports, controller.signal, () => true);
  for (let i = 0; i < 12 && !dispatched; i++) await Promise.resolve();
  expect(dispatched).toBe(true);
  controller.abort();
  expect(await result).toBeNull();
  expect(calls.dismissed).toBe(0);
  complete(session);
  await Promise.resolve();
});
test('invalid entropy, origin, challenge or browser return fails before exchange', async () => {
  for (const overrides of [
    { origin: 'http://local.invalid' },
    { randomBytes: async () => new Uint8Array(8) },
    { sha256Base64: async () => 'plain-verifier-is-forbidden' },
    { openBrowser: async () => ({ type: 'opened' }) },
    { openBrowser: async () => ({ type: 'success', url: 'https://foreign.invalid/?code=private' }) },
  ]) {
    const { ports, calls } = setup(overrides);
    await expect(runNativeGoogleSignIn(ports, new AbortController().signal, () => true)).rejects.toThrow();
    expect(calls.exchanges).toEqual([]);
  }
});
test('an exchange failure is not retried and an abort before start does not open a browser', async () => {
  let exchanges = 0;
  const { ports } = setup({ exchange: async () => { exchanges++; throw new Error('offline'); } });
  await expect(runNativeGoogleSignIn(ports, new AbortController().signal, () => true)).rejects.toThrow('offline');
  expect(exchanges).toBe(1);
  const controller = new AbortController(); controller.abort();
  const cancelled = setup();
  expect(await runNativeGoogleSignIn(cancelled.ports, controller.signal, () => true)).toBeNull();
  expect(cancelled.calls.random).toEqual([]);
});
