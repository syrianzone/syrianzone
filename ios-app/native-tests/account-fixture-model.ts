import { canonicalHttpsOrigin } from '../src/platform/site-origin';
import { legacyPersistence, type PersistenceScope } from '../src/platform/persistence-scope-model';
import { externalReadUrl } from '../src/platform/external-protocol';
import { decodePublicPopup } from '../src/platform/site-popup-model';
import { record } from '../src/platform/validation';
import users from './fixture-users.json';

export const fixtureOrigin = 'https://127.0.0.1:9443';
export const fixtureUsers = Object.freeze(users);
export type FixtureUser = keyof typeof fixtureUsers;
export type FixtureLaunch = { kind: 'cleanup' } | { kind: 'session'; user: FixtureUser; gate: string; variant?: 'popup-long' | 'transit-studio' };
const rejectConfiguration = (): never => { throw new Error('Local fixture configuration rejected.'); };

export function fixtureNavigationSubmission(text: unknown, sequence: number): { destination: string; sequence: number; url: string } {
  if (typeof text !== 'string' || !/^[a-z0-9_]+(?:\?[^#\u0000-\u001f]{0,4096})?$/.test(text)
    || !Number.isSafeInteger(sequence) || sequence < 1) throw new Error('Local fixture navigation rejected.');
  return { destination: text, sequence, url: `syrianzone://feature/${text}` };
}

export function parseFixtureLaunch(compiledOrigin: string, input: string): FixtureLaunch {
  try {
    if (canonicalHttpsOrigin(compiledOrigin) !== fixtureOrigin) return rejectConfiguration();
    const url = new URL(input);
    if (url.protocol !== 'syrianzone:' || url.hostname !== 'fixture' || url.port || url.username || url.password) return rejectConfiguration();
    if (url.pathname === '/cleanup' && !url.search && !url.hash) return { kind: 'cleanup' };
    const user = url.searchParams.get('user'), variant = url.searchParams.get('variant');
    const gate = decodeURIComponent(url.hash.slice(1));
    if (url.pathname !== '/session' || Array.from(url.searchParams).length !== (variant === null ? 1 : 2)
      || !user || !Object.hasOwn(fixtureUsers, user) || !/^[A-Za-z0-9_-]{16,256}$/.test(gate)
      || variant !== null && (!['popup-long', 'transit-studio'].includes(variant) || user !== 'member')) return rejectConfiguration();
    return { kind: 'session', user: user as FixtureUser, gate, ...(variant === 'popup-long' || variant === 'transit-studio' ? { variant } : {}) };
  } catch { return rejectConfiguration(); }
}

export function decodeFixtureSession(value: unknown): { origin: string; token: string } {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  if (row.origin !== fixtureOrigin || typeof row.token !== 'string' || !/^\d+\|[A-Za-z0-9_-]{16,256}$/.test(row.token)) throw new Error('Local fixture session rejected.');
  return { origin: fixtureOrigin, token: row.token };
}

export function assertFixtureScope(value: unknown): asserts value is PersistenceScope {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const token = row.tokenKey;
  const suffix = typeof token === 'string' ? token.slice(legacyPersistence.tokenKey.length) : '';
  if (row.origin !== fixtureOrigin || !/^\.[a-f0-9]{64}$/.test(suffix) || Object.entries(legacyPersistence).some(([key, original]) => row[key] !== original + suffix))
    throw new Error('Local fixture persistence boundary rejected.');
}

export const longPopup = Object.freeze({
  enabled: true, version: 1_900_000_157,
  title: 'صوتك بيعمل فرق: ساهم معنا لفتح الخدمات التقنية لأهل سوريا',
  description: 'ساهم في فك الحظر عن الخدمات التقنية في سوريا. شارك برأيك لتحديد الخدمات الأكثر أهمية للناس، وساعد في إيصال هذه الأولويات إلى الجهات المعنية بشكل واضح وموثّق.',
  buttonText: 'صوّت الآن', dismissText: 'لاحقاً', link: 'https://example.invalid/native-popup-layout'
});

interface FixtureUploadBody {
  kind: 'none' | 'uninspected' | 'form-data' | 'unreadable';
  partCount: number | null;
  parts: { field: string; kind: 'file' | 'text' | 'other'; hasUri: boolean; hasName: boolean; mime: string }[];
}
export interface FixtureUploadDiagnostic {
  sequence: number; observedAt: number; phase: 'request' | 'response' | 'rejected'; method: 'POST'; path: '/api/v1/places';
  body?: FixtureUploadBody; status?: number; redirected?: boolean; boundaryAccepted?: boolean;
  errorName?: string; errorCode?: number | string | null;
}
function uploadBodyShape(body: unknown): FixtureUploadBody {
  if (body == null) return { kind: 'none', partCount: 0, parts: [] };
  if (typeof body !== 'object') return { kind: 'uninspected', partCount: null, parts: [] };
  try {
    if (!('getParts' in body) || typeof body.getParts !== 'function') return { kind: 'uninspected', partCount: null, parts: [] };
    const parts: unknown = body.getParts();
    if (!Array.isArray(parts)) return { kind: 'unreadable', partCount: null, parts: [] };
    return { kind: 'form-data', partCount: parts.length, parts: parts.slice(0, 15).map(value => {
      const part = value && typeof value === 'object' ? value as Record<string, unknown> : {};
      const hasUri = typeof part.uri === 'string', hasName = typeof part.name === 'string';
      return { field: ['name', 'category', 'description', 'lat', 'lng', 'photos[]'].includes(String(part.fieldName)) ? String(part.fieldName) : 'other',
        kind: hasUri ? 'file' : typeof part.string === 'string' ? 'text' : 'other', hasUri, hasName,
        mime: part.type == null ? 'missing' : ['image/png', 'image/jpeg', 'image/webp'].includes(String(part.type)) ? String(part.type) : 'other' };
    }) };
  } catch { return { kind: 'unreadable', partCount: null, parts: [] }; }
}
function uploadFailure(error: unknown): Pick<FixtureUploadDiagnostic, 'errorName' | 'errorCode'> {
  try {
    const row = error && typeof error === 'object' ? error as Record<string, unknown> : {};
    const name = ['Error', 'TypeError', 'AbortError', 'NetworkError'].includes(String(row.name)) ? String(row.name) : 'OtherError';
    const code = row.code;
    return { errorName: name, errorCode: typeof code === 'number' && Number.isSafeInteger(code) && Math.abs(code) <= 1_000_000 ? code
      : typeof code === 'string' && ['ECONNRESET', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH', 'ETIMEDOUT', 'ECANCELED', 'ERR_NETWORK', 'ERR_ABORTED'].includes(code) ? code : null };
  } catch { return { errorName: 'OtherError', errorCode: null }; }
}

export function fixtureFetch(transport: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>, options: {
  publicQuranReads?: boolean; onPublicQuranRead?(url: string, status: number): void;
  popupVariant?: 'popup-long'; onPopupOverride?(): void;
  onUploadDiagnostic?(value: FixtureUploadDiagnostic): void;
} = {}): typeof fetch {
  if (options.popupVariant !== undefined && options.popupVariant !== 'popup-long') return rejectConfiguration();
  let uploadSequence = 0;
  const observeUpload = (value: Omit<FixtureUploadDiagnostic, 'observedAt'>): void => {
    try { options.onUploadDiagnostic?.({ ...value, observedAt: Date.now() }); } catch { /* Observation never changes the request result. */ }
  };
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url: URL;
    try { url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url); }
    catch { throw new Error('Local fixture network boundary rejected.'); }
    const local = url.origin === fixtureOrigin;
    if (url.username || url.password) throw new Error('Local fixture network boundary rejected.');
    if (!local) {
      const request = typeof input !== 'string' && input instanceof Request ? input : null;
      const headers = new Headers(init?.headers ?? request?.headers);
      try {
        if (!options.publicQuranReads || externalReadUrl(url.href).hostname !== 'api-staging.mp3quran.net'
          || (init?.method ?? request?.method ?? 'GET').toUpperCase() !== 'GET' || init?.body != null || request?.body != null
          || init?.credentials === 'include' || request?.credentials === 'include'
          || [...headers.keys()].some(name => !['accept', 'user-agent'].includes(name))) throw new Error('rejected');
      } catch { throw new Error('Local fixture network boundary rejected.'); }
    }
    const requestInput = typeof input !== 'string' && input instanceof Request ? input : null;
    const upload = options.onUploadDiagnostic && local && url.pathname === '/api/v1/places' && !url.search && !url.hash
      && (init?.method ?? requestInput?.method ?? 'GET').toUpperCase() === 'POST'
      ? { sequence: ++uploadSequence, method: 'POST' as const, path: '/api/v1/places' as const } : null;
    if (upload) observeUpload({ ...upload, phase: 'request', body: uploadBodyShape(init?.body) });
    let response: Response;
    try { response = await transport(input, { ...init, redirect: 'error', credentials: 'omit' }); }
    catch (error) { if (upload) observeUpload({ ...upload, phase: 'rejected', ...uploadFailure(error) }); throw error; }
    const boundaryRejected = response.redirected || Boolean(local ? response.url && new URL(response.url).origin !== fixtureOrigin : response.url !== url.href);
    if (upload) observeUpload({ ...upload, phase: 'response', status: response.status, redirected: response.redirected, boundaryAccepted: !boundaryRejected });
    if (boundaryRejected) throw new Error('Local fixture network boundary rejected.');
    if (!local) options.onPublicQuranRead?.(url.href, response.status);
    if (options.popupVariant !== 'popup-long') return response;
    const request = typeof input !== 'string' && input instanceof Request ? input : null;
    const headers = new Headers(init?.headers ?? request?.headers);
    if (local && url.pathname === '/' && !url.search && !url.hash
      && (init?.method ?? request?.method ?? 'GET').toUpperCase() === 'GET'
      && init?.body == null && request?.body == null && init?.credentials !== 'include' && request?.credentials !== 'include'
      && headers.get('X-Inertia') === 'true' && !['Authorization', 'Cookie', 'X-Native-Fixture-Key'].some(name => headers.has(name))
      && response.status === 200 && response.headers.get('content-type')?.includes('application/json')
      && response.headers.get('X-Inertia') === 'true') {
      if (response.url !== url.href) throw new Error('Local popup fixture response rejected.');
      const body = await response.clone().text();
      if (body.length > 2_000_000) throw new Error('Local popup fixture response rejected.');
      const page = record(JSON.parse(body)), props = record(page.props);
      if (page.component !== 'Home') throw new Error('Local popup fixture response rejected.');
      decodePublicPopup(props.sitePopup);
      const outputHeaders = new Headers(response.headers);
      for (const name of ['Content-Length', 'Content-Encoding', 'ETag']) outputHeaders.delete(name);
      outputHeaders.set('Cache-Control', 'no-store');
      const replaced = new Response(JSON.stringify({ ...page, props: { ...props, sitePopup: longPopup } }), {
        status: response.status, statusText: response.statusText, headers: outputHeaders
      });
      // Preserve the verified URL while returning explicit synthetic fixture data.
      Object.defineProperty(replaced, 'url', { value: response.url });
      options.onPopupOverride?.();
      return replaced;
    }
    return response;
  }) as typeof fetch;
}
