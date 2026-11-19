import type { ApiClient } from '../api';
import { decodeMobileSession, superadminCredentials, type MobileSession } from './mobile-session-model';

export function requestSuperadminSession(client: Pick<ApiClient, 'request'>, email: string, password: string, signal?: AbortSignal): Promise<MobileSession> {
  return client.request('auth/superadmin/token', decodeMobileSession, {
    method: 'POST', authenticated: false, body: superadminCredentials(email, password), ...(signal ? { signal } : {}),
  });
}
