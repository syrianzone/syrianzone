import '@inertiajs/core';

/** One dev-only identity preset, as `AutoLoginDevUser` sends it. */
interface DevRole {
    /** The preset id, also the `/dev/impersonate/{id}` segment. */
    id: string;
    /** The Arabic label the switcher prints. */
    label: string;
    /** Which icon to draw; one of the keys `DevRoleSwitcher` maps. */
    icon: string;
}

interface DevProps {
    enabled: boolean;
    roles: DevRole[];
    currentRole: string | null;
}

// Inertia 2 reads shared props through `PageProps` in @inertiajs/core (the
// @inertiajs/react module re-exports nothing new), so that is where the dev
// props are declared.
declare module '@inertiajs/core' {
    interface PageProps {
        dev?: DevProps;
    }
}
