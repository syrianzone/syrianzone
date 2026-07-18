import type { AuthApi } from './api';
import { completeAuthCallback } from './callback';
import type { PendingAuthTransaction } from './pending';

const user = {
  avatar_url: null,
  email: 'admin@example.test',
  id: 7,
  is_banned: false,
  name: 'Admin',
  role: 'admin',
};
const transaction: PendingAuthTransaction = {
  createdAt: 1,
  deviceName: 'syrianzone-ios',
  redirectUri: 'syrianzone://auth/callback',
  state: 's'.repeat(43),
  verifier: 'v'.repeat(43),
};

function dependencies() {
  const api: AuthApi = {
    exchange: jest.fn(async () => ({
      expires_at: '2026-08-01T00:00:00Z',
      token: '7|token',
      token_type: 'Bearer' as const,
      user,
    })),
    getUser: jest.fn(async () => user),
    logout: jest.fn(),
  };
  return {
    api,
    pendingAuth: {
      clear: jest.fn(async () => undefined),
      load: jest.fn(async () => transaction),
      save: jest.fn(async () => undefined),
    },
    tokenStorage: {
      get: jest.fn(async () => null as string | null),
      set: jest.fn(async () => undefined),
    },
  };
}

describe('mobile auth callback completion', () => {
  test('verifies state, exchanges PKCE, and persists the bearer token', async () => {
    const deps = dependencies();
    const callback = `syrianzone://auth/callback?code=once&state=${transaction.state}`;

    await expect(
      completeAuthCallback(callback, transaction, deps),
    ).resolves.toEqual(user);
    expect(deps.api.exchange).toHaveBeenCalledWith({
      code: 'once',
      codeVerifier: transaction.verifier,
      deviceName: transaction.deviceName,
    });
    expect(deps.tokenStorage.set).toHaveBeenCalledWith('7|token');
    expect(deps.pendingAuth.clear).toHaveBeenCalled();
  });

  test('rejects the wrong state before exchanging', async () => {
    const deps = dependencies();
    await expect(
      completeAuthCallback(
        'syrianzone://auth/callback?code=once&state=attacker',
        transaction,
        deps,
      ),
    ).rejects.toMatchObject({ code: 'state_mismatch' });
    expect(deps.api.exchange).not.toHaveBeenCalled();
  });

  test('recovers when the foreground browser already exchanged the code', async () => {
    const deps = dependencies();
    jest.mocked(deps.api.exchange).mockRejectedValueOnce(new Error('used'));
    deps.tokenStorage.get.mockResolvedValueOnce('7|token');

    await expect(
      completeAuthCallback(
        `syrianzone://auth/callback?code=once&state=${transaction.state}`,
        transaction,
        deps,
      ),
    ).resolves.toEqual(user);
    expect(deps.api.getUser).toHaveBeenCalled();
  });
});
