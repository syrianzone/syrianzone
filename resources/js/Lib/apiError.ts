/**
 * Standardized API error shape returned by the Laravel backend.
 *
 * - `message`: Human-readable error message (always present on 4xx/5xx JSON responses).
 * - `errors`: Field-level validation messages returned on HTTP 422.
 * - `code`: Optional machine-readable error code (e.g. `OUT_OF_BOUNDS`).
 * - `error`: Legacy alias for `message` kept for backwards compatibility.
 */
export interface ApiErrorPayload {
    message?: string;
    errors?: Record<string, string[] | string>;
    code?: string;
    error?: string;
}

/**
 * Extract a single user-facing error message from an Axios error, Fetch error,
 * or raw response payload.
 *
 * Checks `errors` (first validation error), then `message` (standard Laravel
 * convention), then `error` (legacy fallback), and finally `fallback`.
 */
export function extractApiErrorMessage(err: unknown, fallback = 'حدث خطأ غير متوقع'): string {
    const data = unwrapErrorData(err);
    if (data) {
        if (data.errors && typeof data.errors === 'object') {
            for (const val of Object.values(data.errors)) {
                if (Array.isArray(val) && typeof val[0] === 'string' && val[0]) {
                    return val[0];
                }
                if (typeof val === 'string' && val) {
                    return val;
                }
            }
        }
        if (typeof data.message === 'string' && data.message) {
            return data.message;
        }
        if (typeof data.error === 'string' && data.error) {
            return data.error;
        }
    }

    return fallback;
}

/**
 * Extract a flat `{ field: firstMessage }` map from a 422 validation error.
 */
export function extractApiFieldErrors(err: unknown): Record<string, string> {
    const data = unwrapErrorData(err);
    const raw = data?.errors;
    if (!raw || typeof raw !== 'object') {
        return {};
    }

    const out: Record<string, string> = {};
    for (const [key, val] of Object.entries(raw)) {
        if (Array.isArray(val) && typeof val[0] === 'string') {
            out[key] = val[0];
        } else if (typeof val === 'string') {
            out[key] = val;
        }
    }

    return out;
}

function unwrapErrorData(err: unknown): ApiErrorPayload | null {
    if (!err || typeof err !== 'object') {
        return null;
    }

    const maybeAxios = err as { response?: { data?: unknown }; data?: unknown };
    const payload = maybeAxios.response?.data ?? maybeAxios.data ?? err;

    if (payload && typeof payload === 'object') {
        return payload as ApiErrorPayload;
    }

    return null;
}
