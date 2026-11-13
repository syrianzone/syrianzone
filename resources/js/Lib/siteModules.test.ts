import { describe, expect, it } from 'vitest';
import { CAPABILITIES } from './capabilities';
import { SITE_ICON_MAP, SITE_ICON_OPTIONS, SITE_LINKS } from './siteLinks';
import {
    ADMIN_SECTIONS,
    SITE_MODULES,
    adminSectionAllowed,
    isCapabilityModule,
    siteModule,
} from './siteModules';

describe('the site-module catalogue', () => {
    it('has one entry per section id and href', () => {
        expect(new Set(SITE_MODULES.map((module) => module.id)).size).toBe(SITE_MODULES.length);
        expect(new Set(SITE_MODULES.map((module) => module.href)).size).toBe(SITE_MODULES.length);
    });

    it('gives every module the fields the navbar and the search read', () => {
        for (const module of SITE_MODULES) {
            expect(module.title, module.id).not.toBe('');
            expect(module.description, module.id).not.toBe('');
            expect(module.target, module.id).not.toBe('');
            expect(typeof module.navbarSticky, module.id).toBe('boolean');
        }
    });

    it('resolves every icon key it names', () => {
        for (const module of SITE_MODULES) {
            if (module.iconKey === null) continue;
            expect(SITE_ICON_MAP[module.iconKey], `${module.id} -> ${module.iconKey}`).toBeDefined();
        }
    });

    it('offers every icon a module uses in the admin picker', () => {
        const offered = new Set(SITE_ICON_OPTIONS.map((option) => option.key));
        for (const module of SITE_MODULES) {
            if (module.iconKey === null) continue;
            expect(offered.has(module.iconKey), `${module.id} -> ${module.iconKey}`).toBe(true);
        }
    });

    it('finds modules by id', () => {
        expect(siteModule('transit')?.href).toBe('/transit');
        expect(siteModule('nope')).toBeNull();
    });
});

describe('the client fallback', () => {
    it('is the catalogue, not a second list', () => {
        expect(SITE_LINKS).toHaveLength(SITE_MODULES.length);
        expect(SITE_LINKS.map((link) => link.id)).toEqual(SITE_MODULES.map((module) => module.id));
        expect(SITE_LINKS.map((link) => link.href)).toEqual(SITE_MODULES.map((module) => module.href));
    });

    it('carries the sub-entries the server catalogue has', () => {
        const muslim = SITE_LINKS.find((link) => link.id === 'muslim');
        expect(muslim?.subCategories?.map((sub) => sub.id)).toEqual([
            'muslim_prayer',
            'muslim_quran',
            'muslim_radio',
        ]);
    });

    it('shows every entry by default', () => {
        for (const link of SITE_LINKS) {
            expect(link.enabled, link.id).toBe(true);
            expect(link.showOnHome, link.id).toBe(true);
            expect(link.showInNavbar, link.id).toBe(true);
        }
    });
});

describe('the admin cards', () => {
    it('names a route and a gate for each one', () => {
        for (const section of ADMIN_SECTIONS) {
            expect(section.href.startsWith('/'), section.id).toBe(true);
            expect(section.label, section.id).not.toBe('');
        }
        expect(new Set(ADMIN_SECTIONS.map((section) => section.id)).size).toBe(ADMIN_SECTIONS.length);
    });

    it('only names capabilities and capability modules that exist', () => {
        const all = new Set<string>(CAPABILITIES);
        for (const section of ADMIN_SECTIONS) {
            if (section.gate.kind === 'capability') {
                expect(all.has(section.gate.capability), `${section.id} -> ${section.gate.capability}`).toBe(true);
            }
            if (section.gate.kind === 'module') {
                expect(isCapabilityModule(section.gate.module), `${section.id} -> ${section.gate.module}`).toBe(true);
            }
        }
    });

    it('opens a module card for any capability in that module', () => {
        const places = ADMIN_SECTIONS.find((section) => section.id === 'places');
        expect(places).toBeDefined();
        if (!places) return;

        expect(adminSectionAllowed(places, () => false, (module) => module === 'places')).toBe(true);
        expect(adminSectionAllowed(places, () => false, () => false)).toBe(false);
    });

    it('opens the token card for anyone holding a capability', () => {
        const tokens = ADMIN_SECTIONS.find((section) => section.id === 'api_tokens');
        expect(tokens).toBeDefined();
        if (!tokens) return;

        expect(adminSectionAllowed(tokens, () => false, () => false)).toBe(false);
        expect(adminSectionAllowed(tokens, (capability) => capability === 'site.navigation', () => false)).toBe(true);
    });
});
