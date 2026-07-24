import { WebBrowserResultType } from 'expo-web-browser';

import type { AuthApi } from './api';
import { AuthError } from './errors';
import {
  createBrowserLogin,
  validateAuthRedirectUri,
  type OpenAuthSession,
} from './browser';

const user = {
  avatar_url: 'https://images.example.test/avatar.png',
  email: 'admin@example.test',
  id: 7,
  is_banned: false,
  name: 'Mobile Admin',
  role: 'admin',
};

function createDependencies() {
  const api: AuthApi = {
    exchange: jest.fn(async () => ({
      expires_at: '2026-08-14T10:00:00Z',
      token: '7|plain-token',
      token_type: 'Bearer' as const,
      user,
    })),
    getUser: jest.fn(),
    logout: jest.fn(),
  };
  const tokenStorage = {
    clear: jest.fn(),
    get: jest.fn(),
    set: jest.fn(async () => undefined),
  };
  const pendingAuth = {
    clear: jest.fn(async () => undefined),
    load: jest.fn(async () => null),
    save: jest.fn(async () => undefined),
  };
  const openAuthSession = jest.fn<
    ReturnType<OpenAuthSession>,
    Parameters<OpenAuthSession>
  >(
    async () => ({
      type: 'success' as const,
      url:
        'syrianzone://auth/callback?code=one-time-code&state=expected-state',
    }),
  );

  return {
    api,
    apiOrigin: 'https://syrian.zone',
    createPkce: jest.fn(async () => ({
      challenge: 'challenge'.padEnd(43, 'c'),
      state: 'expected-state',
      verifier: 'verifier'.padEnd(43, 'v'),
    })),
    deviceName: 'syrianzone-ios',
    getRedirectUri: jest.fn(() =>
      'syrianzone://auth/callback'
    ),
    openAuthSession,
    pendingAuth,
    tokenStorage,
  };
}

test('opens the system browser and exchanges a verified callback once', async () => {
  const dependencies = createDependencies();
  const login = createBrowserLogin(dependencies);

  await expect(login()).resolves.toEqual({ status: 'authenticated', user });

  const startUrl = new URL(dependencies.openAuthSession.mock.calls[0]![0]);
  expect(startUrl.origin + startUrl.pathname).toBe(
    'https://syrian.zone/api/mobile/auth/google',
  );
  expect(Object.fromEntries(startUrl.searchParams)).toEqual({
    code_challenge: 'challenge'.padEnd(43, 'c'),
    code_challenge_method: 'S256',
    redirect_uri: 'syrianzone://auth/callback',
    state: 'expected-state',
  });
  expect(dependencies.openAuthSession).toHaveBeenCalledWith(
    startUrl.toString(),
    'syrianzone://auth/callback',
    { preferUniversalLinks: false },
  );
  expect(dependencies.api.exchange).toHaveBeenCalledTimes(1);
  expect(dependencies.api.exchange).toHaveBeenCalledWith({
    code: 'one-time-code',
    codeVerifier: 'verifier'.padEnd(43, 'v'),
    deviceName: 'syrianzone-ios',
  });
  expect(dependencies.tokenStorage.set).toHaveBeenCalledWith('7|plain-token');
  expect(dependencies.pendingAuth.save).toHaveBeenCalledWith(
    expect.objectContaining({
      deviceName: 'syrianzone-ios',
      redirectUri: 'syrianzone://auth/callback',
      state: 'expected-state',
      verifier: 'verifier'.padEnd(43, 'v'),
    }),
  );
  expect(dependencies.pendingAuth.clear).toHaveBeenCalled();
});

test.each([WebBrowserResultType.CANCEL, WebBrowserResultType.DISMISS])(
  'treats a %s browser result as a safe cancellation',
  async (type) => {
    const dependencies = createDependencies();
    dependencies.openAuthSession.mockResolvedValueOnce({ type });

    await expect(createBrowserLogin(dependencies)()).resolves.toEqual({
      status: 'cancelled',
    });
    expect(dependencies.api.exchange).not.toHaveBeenCalled();
    expect(dependencies.tokenStorage.set).not.toHaveBeenCalled();
    expect(dependencies.pendingAuth.clear).toHaveBeenCalled();
  },
);

test('rejects a callback with a different state before exchanging', async () => {
  const dependencies = createDependencies();
  dependencies.openAuthSession.mockResolvedValueOnce({
    type: 'success',
    url:
      'syrianzone://auth/callback?code=one-time-code&state=attacker-state',
  });

  await expect(createBrowserLogin(dependencies)()).rejects.toMatchObject({
    code: 'state_mismatch',
  } satisfies Partial<AuthError>);
  expect(dependencies.api.exchange).not.toHaveBeenCalled();
  expect(dependencies.tokenStorage.set).not.toHaveBeenCalled();
});

test('rejects a redirect from a different callback path', async () => {
  const dependencies = createDependencies();
  dependencies.openAuthSession.mockResolvedValueOnce({
    type: 'success',
    url:
      'syrianzone://attacker/callback?code=one-time-code&state=expected-state',
  });

  await expect(createBrowserLogin(dependencies)()).rejects.toMatchObject({
    code: 'invalid_callback',
  } satisfies Partial<AuthError>);
  expect(dependencies.api.exchange).not.toHaveBeenCalled();
});

test('maps server callback failures without exposing raw values', async () => {
  const dependencies = createDependencies();
  dependencies.openAuthSession.mockResolvedValueOnce({
    type: 'success',
    url:
      'syrianzone://auth/callback?error=access_denied&state=expected-state',
  });

  await expect(createBrowserLogin(dependencies)()).rejects.toEqual(
    new AuthError('access_denied'),
  );
  expect(dependencies.api.exchange).not.toHaveBeenCalled();
});

test('rejects an HTTPS callback without native app-link registration', () => {
  expect(() =>
    validateAuthRedirectUri('https://syrian.zone/mobile/auth/callback'),
  ).toThrow(new AuthError('invalid_callback'));
});

test('keeps the registered custom callback', () => {
  expect(validateAuthRedirectUri('syrianzone://auth/callback')).toBe(
    'syrianzone://auth/callback',
  );
});

test('rejects an HTTPS callback before saving or opening a login', async () => {
  const dependencies = createDependencies();
  dependencies.getRedirectUri.mockReturnValue(
    'https://syrian.zone/mobile/auth/callback',
  );

  await expect(createBrowserLogin(dependencies)()).rejects.toEqual(
    new AuthError('invalid_callback'),
  );
  expect(dependencies.pendingAuth.save).not.toHaveBeenCalled();
  expect(dependencies.openAuthSession).not.toHaveBeenCalled();
});

test('uses the custom callback without universal-link mode', async () => {
  const dependencies = createDependencies();
  dependencies.openAuthSession.mockResolvedValueOnce({
    type: 'success',
    url:
      'syrianzone://auth/callback?code=one-time-code&state=expected-state',
  });

  await expect(createBrowserLogin(dependencies)()).resolves.toMatchObject({
    status: 'authenticated',
  });
  expect(dependencies.openAuthSession).toHaveBeenCalledWith(
    expect.any(String),
    'syrianzone://auth/callback',
    { preferUniversalLinks: false },
  );
});

test('rejects unsupported callback schemes', () => {
  expect(() =>
    validateAuthRedirectUri('javascript:alert(1)'),
  ).toThrow(new AuthError('invalid_callback'));
});

test('rejects an unregistered custom callback path', () => {
  expect(() =>
    validateAuthRedirectUri('syrianzone://attacker/callback'),
  ).toThrow(new AuthError('invalid_callback'));
});
