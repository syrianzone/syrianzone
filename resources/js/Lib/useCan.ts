import { usePage } from '@inertiajs/react';
import type { AuthProps } from '@/types/auth';
import {
    canAny,
    canModule,
    hasCapability,
    type Capability,
    type CapabilityModule,
} from './capabilities';

/**
 * The one way a component asks "may this account do it?".
 *
 * Reads the server-resolved `auth.user.effective_permissions` from the Inertia
 * page props, so it works anywhere inside the app — including pages that render
 * `MainLayout` themselves and therefore run above `AuthProvider`.
 *
 *   const can = useCan();
 *   can('places.approve');
 *
 * Use `useCanAny()` when a control leads to one of several routes and any one
 * of their capabilities is enough.
 */
export function useCan(): (capability: Capability) => boolean {
    const permissions = usePage<{ auth?: AuthProps }>().props.auth?.user?.effective_permissions;

    return (capability) => hasCapability(permissions, capability);
}

export function useCanAny(): (...capabilities: Capability[]) => boolean {
    const permissions = usePage<{ auth?: AuthProps }>().props.auth?.user?.effective_permissions;

    return (...capabilities) => canAny(permissions, ...capabilities);
}

export function useCanModule(): (module: CapabilityModule) => boolean {
    const permissions = usePage<{ auth?: AuthProps }>().props.auth?.user?.effective_permissions;

    return (module) => canModule(permissions, module);
}
