import type { ApiClient } from '../api';
import { decodeMobileSession, type MobileSession } from './mobile-session-model';
import type { NativeGoogleExchange } from './native-google-model';

export function exchangeNativeGoogleSession(client: Pick<ApiClient, 'request'>, body: NativeGoogleExchange, signal: AbortSignal): Promise<MobileSession> {
  return client.request('auth/google/native/token', decodeMobileSession, { method: 'POST', authenticated: false, body, signal });
}
