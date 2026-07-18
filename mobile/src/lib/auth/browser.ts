import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { apiOrigin } from '@/lib/env';
import { tokenStorage } from '@/lib/storage/secure';

import { authApi, type AuthApi } from './api';
import { completeAuthCallback } from './callback';
import { AuthError } from './errors';
import {
  nativePendingAuthStore,
  type PendingAuthStore,
  type PendingAuthTransaction,
} from './pending';
import { createPkceTransaction, type PkceTransaction } from './pkce';
import type { BrowserLoginResult } from './types';

const legacyIosRedirectUri = 'syrianzone://auth/callback';

export type OpenAuthSession = (
  url: string,
  redirectUrl: string,
  options: WebBrowser.AuthSessionOpenOptions,
) => Promise<WebBrowser.WebBrowserAuthSessionResult>;

interface TokenStore {
  get: () => Promise<string | null>;
  set: (token: string) => Promise<void>;
}

export interface BrowserLoginDependencies {
  api: AuthApi;
  apiOrigin: string;
  createPkce: () => Promise<PkceTransaction>;
  deviceName: string;
  getRedirectUri: () => string;
  openAuthSession: OpenAuthSession;
  pendingAuth: PendingAuthStore;
  tokenStorage: TokenStore;
}

export function selectAuthRedirectUri(
  configuredUri: string,
  platform: string,
  platformVersion: number | string,
): string {
  let protocol: string;
  try {
    protocol = new URL(configuredUri).protocol;
  } catch {
    throw new AuthError('invalid_callback');
  }
  if (protocol !== 'https:' && protocol !== 'syrianzone:') {
    throw new AuthError('invalid_callback');
  }

  const numericVersion =
    typeof platformVersion === 'number'
      ? platformVersion
      : Number.parseFloat(platformVersion);
  const needsLegacyIosCallback =
    platform === 'ios' &&
    protocol === 'https:' &&
    (!Number.isFinite(numericVersion) || numericVersion < 17.4);

  return needsLegacyIosCallback ? legacyIosRedirectUri : configuredUri;
}

function defaultRedirectUri(): string {
  const configuredUri =
    process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim() ||
    legacyIosRedirectUri;
  const native = selectAuthRedirectUri(
    configuredUri,
    Platform.OS,
    Platform.Version,
  );
  const redirectUri = AuthSession.makeRedirectUri({
    native,
    path: 'auth/callback',
    scheme: 'syrianzone',
  });
  if (
    selectAuthRedirectUri(redirectUri, Platform.OS, Platform.Version) !==
    redirectUri
  ) {
    throw new AuthError('invalid_callback');
  }
  return redirectUri;
}

function buildStartUrl(
  origin: string,
  redirectUri: string,
  transaction: PkceTransaction,
): string {
  const url = new URL('/api/mobile/auth/google', `${origin}/`);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', transaction.state);
  url.searchParams.set('code_challenge', transaction.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export function createBrowserLogin(
  dependencies: BrowserLoginDependencies,
): () => Promise<BrowserLoginResult> {
  return async () => {
    const transaction = await dependencies.createPkce();
    const redirectUri = dependencies.getRedirectUri();
    const startUrl = buildStartUrl(
      dependencies.apiOrigin,
      redirectUri,
      transaction,
    );
    const pending: PendingAuthTransaction = {
      createdAt: Date.now(),
      deviceName: dependencies.deviceName,
      redirectUri,
      state: transaction.state,
      verifier: transaction.verifier,
    };
    await dependencies.pendingAuth.save(pending);
    let result;
    try {
      result = await dependencies.openAuthSession(startUrl, redirectUri, {
        preferUniversalLinks: redirectUri.startsWith('https://'),
      });
    } catch (error) {
      await dependencies.pendingAuth.clear();
      throw error;
    }

    if (result.type === 'cancel' || result.type === 'dismiss') {
      await dependencies.pendingAuth.clear();
      return { status: 'cancelled' };
    }
    if (result.type !== 'success') {
      await dependencies.pendingAuth.clear();
      throw new AuthError('invalid_callback');
    }
    const user = await completeAuthCallback(result.url, pending, {
      api: dependencies.api,
      pendingAuth: dependencies.pendingAuth,
      tokenStorage: dependencies.tokenStorage,
    });
    return { status: 'authenticated', user };
  };
}

export const nativeBrowserLogin = createBrowserLogin({
  api: authApi,
  apiOrigin,
  createPkce: createPkceTransaction,
  deviceName: `syrianzone-${Platform.OS}`,
  getRedirectUri: defaultRedirectUri,
  openAuthSession: WebBrowser.openAuthSessionAsync,
  pendingAuth: nativePendingAuthStore,
  tokenStorage,
});
