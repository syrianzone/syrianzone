import type { AuthApi } from './api';
import { AuthError } from './errors';
import type { PendingAuthStore, PendingAuthTransaction } from './pending';
import type { AuthUser } from './types';

interface CallbackTokenStorage {
  get: () => Promise<string | null>;
  set: (token: string) => Promise<void>;
}

export interface CompleteAuthCallbackDependencies {
  api: AuthApi;
  pendingAuth: PendingAuthStore;
  tokenStorage: CallbackTokenStorage;
}

let activeCompletion:
  | { promise: Promise<AuthUser>; state: string }
  | null = null;

export function isExpectedAuthCallback(
  actualValue: string,
  expectedValue: string,
): boolean {
  try {
    const actual = new URL(actualValue);
    const expected = new URL(expectedValue);
    return (
      actual.protocol === expected.protocol &&
      actual.hostname === expected.hostname &&
      actual.port === expected.port &&
      actual.pathname === expected.pathname &&
      actual.username === expected.username &&
      actual.password === expected.password
    );
  } catch {
    return false;
  }
}

async function exchangeCallback(
  callbackUrl: string,
  transaction: PendingAuthTransaction,
  dependencies: CompleteAuthCallbackDependencies,
): Promise<AuthUser> {
  if (!isExpectedAuthCallback(callbackUrl, transaction.redirectUri)) {
    throw new AuthError('invalid_callback');
  }
  const callback = new URL(callbackUrl);
  if (callback.searchParams.get('state') !== transaction.state) {
    throw new AuthError('state_mismatch');
  }
  const callbackError = callback.searchParams.get('error');
  if (callbackError) {
    await dependencies.pendingAuth.clear();
    throw new AuthError(
      callbackError === 'access_denied' ? 'access_denied' : 'auth_failed',
    );
  }
  const code = callback.searchParams.get('code');
  if (!code) {
    throw new AuthError('invalid_callback');
  }

  let exchange;
  try {
    exchange = await dependencies.api.exchange({
      code,
      codeVerifier: transaction.verifier,
      deviceName: transaction.deviceName,
    });
  } catch (error) {
    const token = await dependencies.tokenStorage.get();
    if (token) {
      try {
        const user = await dependencies.api.getUser();
        await dependencies.pendingAuth.clear();
        return user;
      } catch {
        // The original exchange error is safer and more useful to classify.
      }
    }
    await dependencies.pendingAuth.clear();
    throw new AuthError('exchange_failed', { cause: error });
  }

  try {
    await dependencies.tokenStorage.set(exchange.token);
  } catch (error) {
    await dependencies.pendingAuth.clear();
    throw new AuthError('storage_failed', { cause: error });
  }
  await dependencies.pendingAuth.clear();
  return exchange.user;
}

export function completeAuthCallback(
  callbackUrl: string,
  transaction: PendingAuthTransaction,
  dependencies: CompleteAuthCallbackDependencies,
): Promise<AuthUser> {
  if (activeCompletion?.state === transaction.state) {
    return activeCompletion.promise;
  }
  const promise = exchangeCallback(callbackUrl, transaction, dependencies);
  activeCompletion = { promise, state: transaction.state };
  void promise.finally(() => {
    if (activeCompletion?.promise === promise) {
      activeCompletion = null;
    }
  }).catch(() => undefined);
  return promise;
}
