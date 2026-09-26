/**
 * Capability checks for components that cannot use `useAuth()`.
 *
 * `AuthProvider` lives inside `MainLayout`, and the page components that render
 * `MainLayout` themselves (Dashboard, Polls) run *above* the provider — calling
 * `useAuth()` in their body throws. Those pages already receive the user through
 * Inertia props, so they read `auth.user.effective_permissions` (resolved
 * server-side by `User::effectivePermissions()`) and use these pure helpers.
 *
 * Always check capabilities, never a role string. A `user` can hold explicit
 * grants, and the module roles that used to imply a whole bundle
 * (transit_admin, govapps_admin, ...) no longer grant anything at all, so a
 * role check hides panels from the first group and offers controls that 403 for
 * the second. `permissions` is the only thing that grants access, apart from
 * superadmin and the deprecated `admin` alias.
 */
export type EffectivePermissions = string[] | null | undefined;

/** True when the resolved capability list contains any capability for `module`. */
export function canModule(perms: EffectivePermissions, module: string): boolean {
    if (!Array.isArray(perms)) return false;

    return perms.some(
        (permission) => typeof permission === 'string' && permission.startsWith(`${module}.`),
    );
}

/** True when the resolved capability list contains any of `capabilities`. */
export function canAny(perms: EffectivePermissions, ...capabilities: string[]): boolean {
    if (!Array.isArray(perms)) return false;

    return capabilities.some((capability) => perms.includes(capability));
}
