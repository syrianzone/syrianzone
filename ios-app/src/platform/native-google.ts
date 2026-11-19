import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { api } from '../api';
import { exchangeNativeGoogleSession } from './native-google-exchange';
import { runNativeGoogleSignIn } from './native-google-model';
import { configuredSiteOrigin } from './site-origin';
import type { MobileSession } from './mobile-session-model';

export function signInNativeGoogle(signal: AbortSignal, isCurrent: () => boolean): Promise<MobileSession | null> {
  return runNativeGoogleSignIn({
    origin: configuredSiteOrigin,
    randomBytes: count => Crypto.getRandomBytesAsync(count),
    sha256Base64: value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value, { encoding: Crypto.CryptoEncoding.BASE64 }),
    openBrowser: (url, callback) => WebBrowser.openAuthSessionAsync(url, callback),
    dismissBrowser: () => WebBrowser.dismissAuthSession(),
    exchange: (body, requestSignal) => exchangeNativeGoogleSession(api, body, requestSignal),
  }, signal, isCurrent);
}
