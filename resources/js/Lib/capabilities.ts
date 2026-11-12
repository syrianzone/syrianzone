import capabilityList from '../../../resources/data/capabilities.json';

/**
 * The capability vocabulary, in one place for both languages.
 *
 * The ids come from `resources/data/capabilities.json`, which
 * `PermissionCatalogue` is pinned to by
 * `tests/Unit/CapabilityCatalogueParityTest.php`. Importing the JSON as an
 * object (rather than an array) is what gives `keyof typeof` the literal union,
 * so `can('places.aprove')` is a compile error instead of a silent false.
 *
 * The server resolves the list (`User::effectivePermissions()`, shared as
 * `auth.user.effective_permissions`); nothing here re-derives what a role
 * grants.
 */
export type Capability = keyof typeof capabilityList;

export type CapabilityModule = Capability extends `${infer Module}.${string}` ? Module : never;

export const CAPABILITIES = Object.keys(capabilityList) as Capability[];

/** The resolved capability list from Inertia props, before validation. */
export type EffectivePermissions = readonly string[] | null | undefined;

export function hasCapability(
    permissions: EffectivePermissions,
    capability: Capability,
): boolean {
    if (!Array.isArray(permissions)) return false;

    return permissions.includes(capability);
}

/** True when the resolved list contains any of `capabilities`. */
export function canAny(
    permissions: EffectivePermissions,
    ...capabilities: Capability[]
): boolean {
    if (!Array.isArray(permissions)) return false;

    return capabilities.some((capability) => permissions.includes(capability));
}

/** True when the resolved list contains any capability in `module`. */
export function canModule(
    permissions: EffectivePermissions,
    module: CapabilityModule,
): boolean {
    if (!Array.isArray(permissions)) return false;

    const prefix = `${module}.`;

    return permissions.some(
        (permission) => typeof permission === 'string' && permission.startsWith(prefix),
    );
}
