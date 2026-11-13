import catalogue from '../../../resources/data/site-modules.json';
import { CAPABILITIES, type Capability, type CapabilityModule } from './capabilities';

/**
 * The site-module catalogue: the one list of the sections the site has.
 *
 * `resources/data/site-modules.json` is read by PHP (`Facts::siteModules()`,
 * which `SiteSetting::defaultNavigationItems()` turns into the stored
 * navigation defaults) and by this module on the browser side, so adding a
 * section is one edit and the navbar, the hover grid, the search, the dashboard
 * admin cards and the sitemap-adjacent navigation all follow.
 *
 * The navigation half of each entry is the *default*: the admin editor stores
 * an override row (`site_navigation`) whose ids and shape are unchanged, and
 * `useSiteNavigation()` serves whichever the server resolved. Everything else
 * here (`description`, `adminSections`, `fullBleedPrefixes`, `navbarSticky`)
 * is read-only UI metadata and is not part of that stored document.
 */
export type NavigationType = 'native' | 'web' | 'external';

export interface SiteSubCategory {
    id: string;
    title: string;
    subtitle: string;
    href: string;
    type: NavigationType;
    target: string;
    iconKey: string | null;
    iconUrl: string | null;
}

export interface SiteModule {
    id: string;
    title: string;
    subtitle: string;
    href: string;
    type: NavigationType;
    target: string;
    iconKey: string | null;
    iconUrl: string | null;
    isInternal: boolean;
    /** Search copy: what the palette matches besides the title and subtitle. */
    description: string;
    subCategories: SiteSubCategory[];
    /** Path prefixes whose pages take the whole viewport (no page scroll). */
    fullBleedPrefixes: string[];
    /** False for sections that keep the navbar in the flow instead of sticky. */
    navbarSticky: boolean;
}

export type AdminGate =
    | { kind: 'capability'; capability: Capability }
    | { kind: 'module'; module: CapabilityModule }
    | { kind: 'anyCapability' };

export interface AdminSection {
    id: string;
    label: string;
    href: string;
    gate: AdminGate;
}

function text(value: unknown, field: string): string {
    if (typeof value !== 'string' || value === '') {
        throw new Error(`site-modules.json: missing ${field}`);
    }

    return value;
}

function optionalText(value: unknown): string | null {
    return typeof value === 'string' && value !== '' ? value : null;
}

function navigationType(value: unknown): NavigationType {
    if (value === 'native' || value === 'external') return value;

    return 'web';
}

function strings(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    return value.filter((entry): entry is string => typeof entry === 'string');
}

function subCategories(value: unknown): SiteSubCategory[] {
    if (!Array.isArray(value)) return [];

    return value.map((raw: Record<string, unknown>) => ({
        id: text(raw.id, 'subCategories[].id'),
        title: text(raw.title, 'subCategories[].title'),
        subtitle: optionalText(raw.subtitle) ?? '',
        href: text(raw.href, 'subCategories[].href'),
        type: navigationType(raw.type),
        target: optionalText(raw.target) ?? text(raw.href, 'subCategories[].href'),
        iconKey: optionalText(raw.iconKey),
        iconUrl: optionalText(raw.iconUrl),
    }));
}

function moduleOf(raw: Record<string, unknown>): SiteModule {
    return {
        id: text(raw.id, 'modules[].id'),
        title: text(raw.title, 'modules[].title'),
        subtitle: optionalText(raw.subtitle) ?? '',
        href: text(raw.href, 'modules[].href'),
        type: navigationType(raw.type),
        target: optionalText(raw.target) ?? text(raw.href, 'modules[].href'),
        iconKey: optionalText(raw.iconKey),
        iconUrl: optionalText(raw.iconUrl),
        isInternal: raw.isInternal !== false,
        description: optionalText(raw.description) ?? optionalText(raw.subtitle) ?? '',
        subCategories: subCategories(raw.subCategories),
        fullBleedPrefixes: strings(raw.fullBleedPrefixes),
        navbarSticky: raw.navbarSticky !== false,
    };
}

/** A capability id from the catalogue, checked against the shared vocabulary. */
function capabilityOf(value: string): Capability {
    const known = CAPABILITIES.find((capability) => capability === value);
    if (known === undefined) {
        throw new Error(`site-modules.json: unknown capability "${value}"`);
    }

    return known;
}

function gateOf(raw: Record<string, unknown>): AdminGate {
    if (typeof raw.capability === 'string') {
        return { kind: 'capability', capability: capabilityOf(raw.capability) };
    }
    if (typeof raw.module === 'string') {
        if (!isCapabilityModule(raw.module)) {
            throw new Error(`site-modules.json: unknown capability module "${raw.module}"`);
        }

        return { kind: 'module', module: raw.module };
    }
    if (raw.anyCapability === true) {
        return { kind: 'anyCapability' };
    }

    throw new Error('site-modules.json: admin section without a usable gate');
}

/** True when `value` prefixes at least one capability id. */
export function isCapabilityModule(value: string): value is CapabilityModule {
    return CAPABILITIES.some((capability) => capability.startsWith(`${value}.`));
}

export const SITE_MODULES: readonly SiteModule[] = catalogue.modules.map((module) => moduleOf(module));

export const ADMIN_SECTIONS: readonly AdminSection[] = catalogue.adminSections.map((section) => ({
    id: text(section.id, 'adminSections[].id'),
    label: text(section.label, 'adminSections[].label'),
    href: text(section.href, 'adminSections[].href'),
    gate: gateOf(section.gate),
}));

/** How many of the navbar's items are shown before the "more" panel. */
export const NAVBAR_TOP_COUNT = catalogue.navbar.topCount;

export function siteModule(id: string | null | undefined): SiteModule | null {
    if (!id) return null;

    return SITE_MODULES.find((module) => module.id === id) ?? null;
}

/**
 * Whether an admin card's gate is satisfied. The caller passes the two
 * capability hooks so this module stays free of React.
 */
export function adminSectionAllowed(
    section: AdminSection,
    can: (capability: Capability) => boolean,
    canModule: (module: CapabilityModule) => boolean,
): boolean {
    switch (section.gate.kind) {
        case 'capability':
            return can(section.gate.capability);
        case 'module':
            return canModule(section.gate.module);
        case 'anyCapability':
            return CAPABILITIES.some((capability) => can(capability));
    }
}
