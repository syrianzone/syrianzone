import { usePage } from '@inertiajs/react';
import { canAny } from '@/Lib/permissions';

/**
 * Capability check for the promises admin pages.
 *
 * These pages render MainLayout themselves, so they run above AuthProvider and
 * cannot call useAuth(); they read the server-resolved
 * `auth.user.effective_permissions` from the Inertia props instead.
 *
 *   const can = useCan();
 *   can('promises.edit')
 */
export function useCan(): (...capabilities: string[]) => boolean {
    const { auth } = usePage().props as { auth?: { user?: { effective_permissions?: string[] } } };
    const perms = auth?.user?.effective_permissions;

    return (...capabilities: string[]) => canAny(perms, ...capabilities);
}
