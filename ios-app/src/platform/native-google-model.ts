import type { MobileSession } from './mobile-session-model';
import { canonicalHttpsOrigin } from './site-origin';

export const nativeGoogleCallback = 'zone.syrian.ios:/oauth/google';
export const nativeGoogleScheme = 'zone.syrian.ios';
const canonicalCode = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const clientState = /^[a-f0-9]{64}$/;
const providerErrors = {
  auth_failed: 'لم يكتمل تسجيل الدخول. حاول مجدداً.',
  auth_expired: 'انتهت مهلة تسجيل الدخول. حاول مجدداً.',
  banned: 'تم حظر هذا الحساب.',
  unverified_email: 'يلزم تأكيد البريد الإلكتروني في حساب Google.',
} as const;
type ProviderError = keyof typeof providerErrors;
export interface NativeGoogleExchange {
  code: string; code_verifier: string; state: string; device_name: string;
}
export interface NativeGooglePorts {
  origin: string;
  randomBytes(count: number): Promise<Uint8Array>;
  sha256Base64(value: string): Promise<string>;
  openBrowser(url: string, callback: string): Promise<{ type: string; url?: string }>;
  dismissBrowser(): void;
  exchange(body: NativeGoogleExchange, signal: AbortSignal): Promise<MobileSession>;
}
function invalidReturn(): never { throw new Error('أعاد تسجيل الدخول استجابة غير صالحة. حاول مجدداً.'); }

export function parseNativeGoogleCallback(input: string, expectedState: string): { code: string } | { error: ProviderError } {
  if (input.length > 1024 || /[\u0000-\u0020\u007f]/.test(input) || input.includes('#') || !input.startsWith(`${nativeGoogleCallback}?`) || !clientState.test(expectedState)) return invalidReturn();
  const url = new URL(input), entries = Array.from(url.searchParams);
  if (url.hash || entries.length !== 2 || url.searchParams.getAll('state').length !== 1 || url.searchParams.get('state') !== expectedState) return invalidReturn();
  const code = url.searchParams.get('code'), error = url.searchParams.get('error');
  if (code && url.searchParams.getAll('code').length === 1 && canonicalCode.test(code)) return { code };
  if (error && url.searchParams.getAll('error').length === 1 && Object.hasOwn(providerErrors, error)) return { error: error as ProviderError };
  return invalidReturn();
}

export async function runNativeGoogleSignIn(ports: NativeGooglePorts, signal: AbortSignal, isCurrent: () => boolean): Promise<MobileSession | null> {
  const current = () => !signal.aborted && isCurrent();
  if (!current()) return null;
  const origin = canonicalHttpsOrigin(ports.origin);
  const secret = async () => {
    const bytes = await ports.randomBytes(32);
    if (bytes.length !== 32) return invalidReturn();
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  };
  const verifier = await secret(), state = await secret();
  if (!current()) return null;
  const challenge = (await ports.sha256Base64(verifier)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (!current()) return null;
  if (!canonicalCode.test(challenge)) return invalidReturn();
  const start = new URL('/auth/google/native', origin);
  start.search = new URLSearchParams({ code_challenge: challenge, code_challenge_method: 'S256', state }).toString();
  let inBrowser = true, cancel!: () => void;
  const cancellation = new Promise<null>(resolve => { cancel = () => resolve(null); });
  const aborted = () => {
    if (inBrowser) { try { ports.dismissBrowser(); } catch { /* The OS may have already closed the owned session. */ } }
    cancel();
  };
  signal.addEventListener('abort', aborted, { once: true });
  try {
    const result = await Promise.race([ports.openBrowser(start.toString(), nativeGoogleCallback), cancellation]);
    inBrowser = false;
    if (!result || !current() || result.type === 'cancel' || result.type === 'dismiss') return null;
    if (result.type !== 'success' || typeof result.url !== 'string') return invalidReturn();
    const parsed = parseNativeGoogleCallback(result.url, state);
    if ('error' in parsed) throw new Error(providerErrors[parsed.error]);
    const session = await Promise.race([ports.exchange({ code: parsed.code, code_verifier: verifier, state, device_name: 'Syrian Zone iOS' }, signal), cancellation]);
    return current() ? session : null;
  } catch (error) {
    if (!current()) return null;
    throw error;
  } finally { signal.removeEventListener('abort', aborted); }
}
