import { z } from 'zod';

import { apiOrigin } from '@/lib/env';
import { tokenStorage } from '@/lib/storage/secure';

import { ApiError, type ValidationFields } from './errors';

type FetchImplementation = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;
type QueryValue = boolean | number | string | null | undefined;

export interface ApiRequestOptions<T> {
  auth?: boolean;
  body?: FormData | unknown;
  headers?: Readonly<Record<string, string>>;
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
  query?: Readonly<Record<string, QueryValue | readonly QueryValue[]>>;
  schema: z.ZodType<T>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ApiClient {
  request: <T>(path: string, options: ApiRequestOptions<T>) => Promise<T>;
}

interface ApiClientDependencies {
  fetchImplementation?: FetchImplementation;
  getAccessToken?: () => Promise<string | null>;
  origin?: string;
}

const errorPayloadSchema = z
  .object({
    code: z.string().optional(),
    error: z.string().optional(),
    errors: z.record(z.string(), z.array(z.string())).optional(),
    message: z.string().optional(),
  })
  .passthrough();

function appendQuery(
  url: URL,
  query: ApiRequestOptions<unknown>['query'],
): void {
  if (!query) {
    return;
  }

  for (const [key, rawValue] of Object.entries(query)) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    }
  }
}

function getSafeError(
  payload: unknown,
  fallbackStatus: number,
): {
  code: string;
  fields?: ValidationFields;
  message: string;
} {
  const parsed = errorPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      code: `http_${fallbackStatus}`,
      message: 'تعذر إكمال الطلب. حاول مرة أخرى.',
    };
  }

  const message = parsed.data.message ?? parsed.data.error;
  return {
    code: parsed.data.code ?? `http_${fallbackStatus}`,
    fields: parsed.data.errors,
    message:
      message && message.length <= 500
        ? message
        : 'تعذر إكمال الطلب. حاول مرة أخرى.',
  };
}

async function readPayload(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return undefined;
  }

  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export function createApiClient({
  fetchImplementation = fetch,
  getAccessToken = tokenStorage.get,
  origin = apiOrigin,
}: ApiClientDependencies = {}): ApiClient {
  const normalizedOrigin = origin.replace(/\/$/, '');
  const trustedOrigin = new URL(normalizedOrigin).origin;

  return {
    async request<T>(
      path: string,
      options: ApiRequestOptions<T>,
    ): Promise<T> {
      if (!path.startsWith('/') || path.startsWith('//')) {
        throw new ApiError(0, 'invalid_path', 'مسار الطلب غير صالح.');
      }

      const url = new URL(path, `${normalizedOrigin}/`);
      if (url.origin !== trustedOrigin) {
        throw new ApiError(0, 'invalid_path', 'مسار الطلب غير صالح.');
      }
      appendQuery(url, options.query);

      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        options.timeoutMs ?? 15_000,
      );
      const abortFromCaller = () => controller.abort();
      options.signal?.addEventListener('abort', abortFromCaller, { once: true });

      try {
        const headers = new Headers({
          Accept: 'application/json',
          ...options.headers,
        });
        const token = options.auth === false ? null : await getAccessToken();
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }

        let requestBody: BodyInit | undefined;
        if (options.body instanceof FormData) {
          requestBody = options.body;
        } else if (options.body !== undefined) {
          requestBody = JSON.stringify(options.body);
          headers.set('Content-Type', 'application/json');
        }

        const response = await fetchImplementation(url.toString(), {
          body: requestBody,
          headers,
          method: options.method ?? 'GET',
          signal: controller.signal,
        });
        const payload = await readPayload(response);

        if (!response.ok) {
          const safe = getSafeError(payload, response.status);
          throw new ApiError(
            response.status,
            safe.code,
            safe.message,
            safe.fields,
          );
        }

        const parsed = options.schema.safeParse(payload);
        if (!parsed.success) {
          throw new ApiError(
            502,
            'invalid_response',
            'أعاد الخادم بيانات غير متوقعة.',
          );
        }
        return parsed.data;
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        if (controller.signal.aborted) {
          throw new ApiError(
            options.signal?.aborted ? 0 : 408,
            options.signal?.aborted ? 'cancelled' : 'timeout',
            options.signal?.aborted
              ? 'تم إلغاء الطلب.'
              : 'انتهت مهلة الاتصال. حاول مرة أخرى.',
            undefined,
            { cause: error },
          );
        }
        throw new ApiError(
          0,
          'network',
          'تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مرة أخرى.',
          undefined,
          { cause: error },
        );
      } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener('abort', abortFromCaller);
      }
    },
  };
}

export const apiClient = createApiClient();

/*
PORT STATUS
  source:     resources/js/Lib/axios.ts (13 lines)
  confidence: high
  todos:      0
  notes:      Native requests use bearer auth, timeouts, and response validation.
*/
