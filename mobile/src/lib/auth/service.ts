import { ApiError } from '@/lib/api/errors';
import { tokenStorage } from '@/lib/storage/secure';

import { authApi, type AuthApi } from './api';
import { nativeBrowserLogin } from './browser';
import { AuthError } from './errors';
import type { AuthUser, BrowserLoginResult } from './types';

interface TokenStorage {
  clear: () => Promise<void>;
  get: () => Promise<string | null>;
}

export interface AuthService {
  bootstrap: () => Promise<AuthUser | null>;
  login: () => Promise<BrowserLoginResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser>;
}

interface AuthServiceDependencies {
  api: AuthApi;
  browserLogin: () => Promise<BrowserLoginResult>;
  tokenStorage: TokenStorage;
}

export function createAuthService(
  dependencies: AuthServiceDependencies,
): AuthService {
  return {
    async bootstrap() {
      let token;
      try {
        token = await dependencies.tokenStorage.get();
      } catch (error) {
        throw new AuthError('bootstrap_failed', { cause: error });
      }
      if (!token) {
        return null;
      }

      try {
        return await dependencies.api.getUser();
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await dependencies.tokenStorage.clear();
          return null;
        }
        throw new AuthError('bootstrap_failed', { cause: error });
      }
    },
    async login() {
      try {
        return await dependencies.browserLogin();
      } catch (error) {
        if (error instanceof AuthError) {
          throw error;
        }
        throw new AuthError('login_failed', { cause: error });
      }
    },
    async logout() {
      let remoteError: unknown;
      let storageError: unknown;
      try {
        await dependencies.api.logout();
      } catch (error) {
        remoteError = error;
      }

      try {
        await dependencies.tokenStorage.clear();
      } catch (error) {
        storageError = error;
      }

      if (remoteError && storageError) {
        throw new AuthError('logout_incomplete', { cause: remoteError });
      }
      if (storageError) {
        throw new AuthError('storage_failed', { cause: storageError });
      }

      if (remoteError) {
        throw new AuthError('logout_failed', { cause: remoteError });
      }
    },
    async refreshUser() {
      try {
        return await dependencies.api.getUser();
      } catch (error) {
        throw new AuthError('refresh_failed', { cause: error });
      }
    },
  };
}

export const nativeAuthService = createAuthService({
  api: authApi,
  browserLogin: nativeBrowserLogin,
  tokenStorage,
});
