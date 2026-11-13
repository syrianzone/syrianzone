/**
 * The shape of `auth.user` as `User::toAuthPayload()` shares it (through the
 * Inertia page props and the `/user` endpoint).
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
    /** The raw stored scopes; the permission editor renders these. */
    permission_scopes?: Record<string, string[]> | null;
    /**
     * The transit governorates this account may act on, resolved by
     * `User::allowedTransitCities()`: null means unrestricted (the superadmin
     * bypass, no scope, or an empty list). Compare against it; never re-derive
     * the rule from `permission_scopes`.
     */
    transit_scope?: string[] | null;
    settings?: Record<string, unknown> | null;
}

export interface AuthProps {
    user: AuthUser | null;
}
