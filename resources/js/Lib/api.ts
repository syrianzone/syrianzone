import axios from 'axios';

/**
 * The one JSON API client.
 *
 * It owns the base path, CSRF (axios reads the `XSRF-TOKEN` cookie itself via
 * `withXSRFToken`), JSON headers, the default timeout and the error contract.
 * Feature modules build typed functions per resource on top of it, so pages
 * never spell a URL or unwrap an axios response.
 */

/** App JSON API prefixes. Features build resource paths from these, not literals. */
export const API_ROOT = '/api';
export const API_V1 = `${API_ROOT}/v1`;

export const DEFAULT_TIMEOUT_MS = 30_000;

export interface ApiRequestConfig {
  params?: Record<string, unknown>;
  signal?: AbortSignal;
  /** Overrides `DEFAULT_TIMEOUT_MS` for calls that are legitimately slower. */
  timeout?: number;
  headers?: Record<string, string>;
  /** Unload saves must outlive the page (Board flushes on `visibilitychange`). */
  keepalive?: boolean;
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    Accept: 'application/json',
  },
  withCredentials: true,
  withXSRFToken: true,
  timeout: DEFAULT_TIMEOUT_MS,
});

function config(options: ApiRequestConfig | undefined) {
  if (!options) return undefined;
  return {
    params: options.params,
    signal: options.signal,
    timeout: options.timeout,
    headers: options.headers,
    // The default (XHR) adapter drops `keepalive`; axios's fetch adapter only
    // forwards it through `fetchOptions`.
    ...(options.keepalive ? { adapter: 'fetch' as const, fetchOptions: { keepalive: true } } : {}),
  };
}

async function request<T>(method: string, path: string, body?: unknown, options?: ApiRequestConfig): Promise<T> {
  // Uploads have no time limit unless the caller sets one: photos over slow mobile links routinely take longer than DEFAULT_TIMEOUT_MS.
  const uploadTimeout = body instanceof FormData && options?.timeout === undefined ? { timeout: 0 } : {};
  const { data } = await http.request<T>({ method, url: path, data: body, ...config(options), ...uploadTimeout });
  return data;
}

export const api = {
  get: <T>(path: string, options?: ApiRequestConfig): Promise<T> => request<T>('get', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: ApiRequestConfig): Promise<T> => request<T>('post', path, body, options),
  put: <T>(path: string, body?: unknown, options?: ApiRequestConfig): Promise<T> => request<T>('put', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: ApiRequestConfig): Promise<T> => request<T>('patch', path, body, options),
  delete: <T>(path: string, body?: unknown, options?: ApiRequestConfig): Promise<T> => request<T>('delete', path, body, options),
};

/** True when the text is product copy the backend wrote, not a framework default. */
export function isArabicMessage(message: string): boolean {
  return /[\u0600-\u06FF]/.test(message);
}

const FALLBACK_MESSAGE = 'حدث خطأ غير متوقع';

const SESSION_STATUSES = [401, 419, 429];

const STATUS_MESSAGES: Record<number, string> = {
  400: 'تعذر تنفيذ الطلب',
  401: 'سجل الدخول للمتابعة',
  403: 'غير مسموح لك بهذا الإجراء',
  404: 'العنصر غير موجود',
  405: 'هذا الإجراء غير متاح',
  409: 'تعارض الطلب مع حالة البيانات الحالية، أعد التحميل وحاول مجدداً',
  413: 'الصور المرفوعة كبيرة جداً، الحد الأقصى 12 ميغابايت لكل صورة',
  419: 'انتهت الجلسة، أعد تحميل الصفحة',
  422: 'تحقق من البيانات المدخلة',
  429: 'محاولات كثيرة، انتظر قليلاً ثم أعد المحاولة',
  500: 'حدث خطأ في الخادم، حاول مجدداً',
  502: 'تعذر الوصول إلى الخادم، حاول مجدداً',
  503: 'الخدمة غير متاحة مؤقتاً، حاول بعد قليل',
  504: 'انتهت مهلة الخادم، حاول مجدداً',
};

function secondsPhrase(seconds: number): string {
  if (seconds <= 1) return 'ثانية واحدة';
  if (seconds === 2) return 'ثانيتان';
  if (seconds <= 10) return `${seconds} ثوانٍ`;
  return `${seconds} ثانية`;
}

interface ErrorBody {
  message?: unknown;
  error?: unknown;
  errors?: unknown;
  retry_after?: unknown;
}

interface ErrorLike {
  response?: { status?: number; data?: unknown; headers?: unknown };
  request?: unknown;
  code?: string;
  status?: number;
  data?: unknown;
  headers?: unknown;
  message?: unknown;
}

function asErrorLike(err: unknown): ErrorLike | null {
  return err && typeof err === 'object' ? (err as ErrorLike) : null;
}

function errorBody(err: unknown): ErrorBody | null {
  const e = asErrorLike(err);
  if (!e) return null;
  const payload = e.response?.data ?? e.data ?? e;
  return payload && typeof payload === 'object' ? (payload as ErrorBody) : null;
}

export function apiErrorStatus(err: unknown): number | undefined {
  const e = asErrorLike(err);
  const status = e?.response?.status ?? e?.status;
  return typeof status === 'number' ? status : undefined;
}

function headerValue(headers: unknown, name: string): string | null {
  if (!headers || typeof headers !== 'object') return null;
  const bag = headers as Record<string, unknown> & { get?: (key: string) => unknown };
  const direct = bag[name] ?? bag[name.toLowerCase()] ?? bag[name.toUpperCase()];
  if (typeof direct === 'string') return direct;
  if (typeof bag.get === 'function') {
    const viaGetter = bag.get(name);
    if (typeof viaGetter === 'string') return viaGetter;
  }
  return null;
}

function retryAfterSeconds(err: unknown): number | null {
  const e = asErrorLike(err);
  const header = headerValue(e?.response?.headers, 'Retry-After') ?? headerValue(e?.headers, 'Retry-After');
  const headerSeconds = header ? Number(header) : NaN;
  if (Number.isFinite(headerSeconds) && headerSeconds > 0) return Math.ceil(headerSeconds);

  const body = errorBody(err);
  const bodySeconds = typeof body?.retry_after === 'number' ? body.retry_after : Number(body?.retry_after);
  if (Number.isFinite(bodySeconds) && bodySeconds > 0) return Math.ceil(bodySeconds);
  return null;
}

function transportMessage(err: unknown): string | null {
  const e = asErrorLike(err);
  if (!e) return null;
  const response = e.response;
  if (!response) {
    if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') return 'انتهت مهلة الطلب، حاول مجدداً';
    if (e.code === 'ERR_CANCELED' || e.code === 'ERR_ABORTED') return 'تم إلغاء الطلب';
    if (e.code === 'ERR_NETWORK' || typeof e.request !== 'undefined') {
      return 'تعذر الاتصال بالخادم، تحقق من اتصالك بالإنترنت وحاول مجدداً';
    }
    return null;
  }
  if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT' || response.status === 408 || response.status === 504) {
    return 'انتهت مهلة الطلب، حاول مجدداً';
  }
  return null;
}

function fieldMessages(err: unknown): Record<string, string> {
  const raw = errorBody(err)?.errors;
  if (!raw || typeof raw !== 'object') return {};

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const message = Array.isArray(value) ? value.find((item) => typeof item === 'string' && item) : value;
    if (typeof message === 'string' && message) {
      out[key.replace(/\.\d+$/, '')] = message;
    }
  }
  return out;
}

/**
 * Field-level messages for inline form errors, first message per field and one
 * key per form field (`photos.0` collapses onto `photos`).
 *
 * `arabicOnly` drops Laravel's English framework messages, which must never
 * reach an Arabic form; the caller then shows `apiErrorMessage` instead.
 */
export function apiFieldErrors(err: unknown, options: { arabicOnly?: boolean } = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, message] of Object.entries(fieldMessages(err))) {
    if (options.arabicOnly && !isArabicMessage(message)) continue;
    if (!(field in out)) out[field] = message;
  }
  return out;
}

/**
 * One Arabic message for any failure: validation field message, server
 * `message`/legacy `error` envelope, 429 (with `Retry-After` when present),
 * session/throttling status, transport/timeout, the caller's `fallback`, then
 * the HTTP status text.
 *
 * A server message that is not Arabic is a framework default, so it is skipped
 * in favour of the fallback.
 */
export function apiErrorMessage(err: unknown, fallback = FALLBACK_MESSAGE): string {
  for (const message of Object.values(fieldMessages(err))) {
    if (isArabicMessage(message)) return message;
  }

  const body = errorBody(err);
  for (const candidate of [body?.message, body?.error]) {
    if (typeof candidate === 'string' && candidate && isArabicMessage(candidate)) return candidate;
  }

  const status = apiErrorStatus(err);
  if (status === 429) {
    const wait = retryAfterSeconds(err);
    if (wait !== null) return `تم تجاوز حد المحاولات المسموح. يرجى الانتظار ${secondsPhrase(wait)} ثم إعادة المحاولة.`;
  }

  // Session and throttling facts outrank any action-specific wording: the user
  // has to sign in, reload or wait whichever action failed.
  if (status !== undefined && SESSION_STATUSES.includes(status)) return STATUS_MESSAGES[status];

  const transport = transportMessage(err);
  if (transport) return transport;

  // A caller-supplied fallback names the action, so it beats the generic text
  // for the remaining statuses.
  if (fallback !== FALLBACK_MESSAGE) return fallback;

  if (status !== undefined && STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];

  return FALLBACK_MESSAGE;
}
