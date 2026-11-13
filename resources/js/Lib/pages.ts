import React, { type ComponentType } from 'react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';

type PageModule = { default: ComponentType };

/**
 * Pages built as their own chunk instead of with the first Inertia bundle. The
 * browser and SSR entries both resolve pages through `pageResolver`, so this is
 * the only place a page is declared heavy.
 */
const DEFERRED_PAGES = ['Transit/admin'];

function isDeferredPage(name: string): boolean {
    return DEFERRED_PAGES.some(
        (prefix) => name === prefix || name.startsWith(`${prefix}/`),
    );
}

/**
 * The Inertia page resolver for both entries. `deferred` is off while
 * server-rendering: there is no client chunk to wait for, so every page loads
 * eagerly and the markup is complete.
 */
export function pageResolver(
    pages: Record<string, () => Promise<PageModule>>,
    { deferred = true }: { deferred?: boolean } = {},
) {
    return (name: string) => {
        const path = `./Pages/${name}.tsx`;
        const page = pages[path];
        if (!page) throw new Error(`Page not found: ${name}`);

        if (deferred && isDeferredPage(name)) {
            return { default: React.lazy(page) };
        }

        return resolvePageComponent(path, pages);
    };
}
