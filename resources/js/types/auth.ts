/**
 * The shape of `auth.user` as `HandleInertiaRequests::userPayload()` shares it.
 *
 * `effective_permissions` is the resolved list (role implications already
 * applied server-side); `permissions` is the raw stored array, which only the
 * admin permission form reads. Capability checks must use the resolved list —
 * use `useCan()` rather than reading either field directly.
 */
export interface AuthUser {
    id: number;
    name: string;
    email: string;
    role: string;
    is_banned?: boolean;
    avatar_url: string | null;
    permissions?: string[];
    effective_permissions?: string[];
    permission_scopes?: Record<string, string[]> | null;
    settings?: Record<string, unknown> | null;
}

export interface AuthProps {
    user: AuthUser | null;
}
