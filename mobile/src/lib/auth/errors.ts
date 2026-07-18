export type AuthErrorCode =
  | 'access_denied'
  | 'auth_failed'
  | 'bootstrap_failed'
  | 'exchange_failed'
  | 'invalid_callback'
  | 'login_failed'
  | 'logout_failed'
  | 'logout_incomplete'
  | 'refresh_failed'
  | 'state_mismatch'
  | 'storage_failed';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = 'AuthError';
  }
}

export function authErrorCode(
  error: unknown,
  fallback: AuthErrorCode,
): AuthErrorCode {
  return error instanceof AuthError ? error.code : fallback;
}
