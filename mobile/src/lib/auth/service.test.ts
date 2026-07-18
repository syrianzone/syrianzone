import { ApiError } from '@/lib/api/errors';

import type { AuthApi } from './api';
import { AuthError } from './errors';
import { createAuthService } from './service';

const user = {
  avatar_url: null,
  email: 'admin@example.test',
  id: 4,
  is_banned: false,
  name: 'Admin',
  role: 'superadmin',
};

function createDependencies() {
  const api: AuthApi = {
    exchange: jest.fn(),
    getUser: jest.fn(async () => user),
    logout: jest.fn(async () => undefined),
  };
  const getToken: jest.MockedFunction<() => Promise<string | null>> = jest.fn(
    async () => 'stored-token',
  );
  const tokenStorage = {
    clear: jest.fn(async () => undefined),
    get: getToken,
    set: jest.fn(),
  };
  return {
    api,
    browserLogin: jest.fn(async () => ({
      status: 'authenticated' as const,
      user,
    })),
    tokenStorage,
  };
}

test('bootstraps the stored bearer session through GET user', async () => {
  const dependencies = createDependencies();

  await expect(createAuthService(dependencies).bootstrap()).resolves.toEqual(
    user,
  );
  expect(dependencies.api.getUser).toHaveBeenCalledTimes(1);
});

test('skips bootstrap when secure storage has no token', async () => {
  const dependencies = createDependencies();
  dependencies.tokenStorage.get.mockResolvedValueOnce(null);

  await expect(createAuthService(dependencies).bootstrap()).resolves.toBeNull();
  expect(dependencies.api.getUser).not.toHaveBeenCalled();
});

test('clears an expired stored token after an unauthorized bootstrap', async () => {
  const dependencies = createDependencies();
  dependencies.api.getUser = jest.fn(async () => {
    throw new ApiError(401, 'http_401', 'raw server detail');
  });

  await expect(createAuthService(dependencies).bootstrap()).resolves.toBeNull();
  expect(dependencies.tokenStorage.clear).toHaveBeenCalledTimes(1);
});

test('clears local credentials even when remote logout fails', async () => {
  const dependencies = createDependencies();
  dependencies.api.logout = jest.fn(async () => {
    throw new ApiError(503, 'http_503', 'raw server detail');
  });

  await expect(createAuthService(dependencies).logout()).rejects.toEqual(
    new AuthError('logout_failed'),
  );
  expect(dependencies.tokenStorage.clear).toHaveBeenCalledTimes(1);
});

test('reports an incomplete logout when revoke and local deletion both fail', async () => {
  const dependencies = createDependencies();
  dependencies.api.logout = jest.fn(async () => {
    throw new ApiError(503, 'http_503', 'raw server detail');
  });
  dependencies.tokenStorage.clear = jest.fn(async () => {
    throw new Error('secure storage unavailable');
  });

  await expect(createAuthService(dependencies).logout()).rejects.toEqual(
    new AuthError('logout_incomplete'),
  );
});
