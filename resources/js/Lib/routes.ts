import { SITE_MODULES, type SiteModule } from './siteModules';

/**
 * Route shape, in one place.
 *
 * The shell (navbar, layout chrome, search) used to decide "what kind of
 * route is this?" with its own prefixes and regexes, so a new section meant
 * editing several files that could not see each other. The section prefixes
 * and layout flags now come from `resources/data/site-modules.json`; these
 * helpers read them.
 */

/** A pathname with the query string, hash, duplicate and trailing slashes gone. */
export function pathnameOf(url: string | null | undefined): string {
    if (!url) return '/';

    const [rawPath = '/'] = url.split(/[?#]/);
    const trimmed = rawPath.replace(/\/{2,}/g, '/').replace(/(.)\/+$/, '$1');

    return trimmed === '' ? '/' : trimmed;
}

/** True when `pathname` is `prefix` itself or a page under it. */
export function isUnderPath(pathname: string, prefix: string): boolean {
    const path = pathnameOf(pathname);
    const base = pathnameOf(prefix);
    if (base === '/') return true;

    return path === base || path.startsWith(`${base}/`);
}

/** The section a pathname belongs to: the catalogue entry with the longest match. */
export function siteModuleOf(pathname: string): SiteModule | null {
    const path = pathnameOf(pathname);
    let match: SiteModule | null = null;

    for (const module of SITE_MODULES) {
        if (!module.href.startsWith('/')) continue;
        if (!isUnderPath(path, module.href)) continue;
        if (match === null || module.href.length > match.href.length) match = module;
    }

    return match;
}

/** The id of the section a pathname belongs to, or null outside the catalogue. */
export function routeFamily(pathname: string): string | null {
    return siteModuleOf(pathname)?.id ?? null;
}

/** Pages that take the whole viewport: the catalogue says which. */
export function isFullBleed(pathname: string): boolean {
    const path = pathnameOf(pathname);

    return SITE_MODULES.some((module) =>
        module.fullBleedPrefixes.some((prefix) => isUnderPath(path, prefix)),
    );
}

/** Whether the navbar stays sticky on this page. */
export function isNavbarSticky(pathname: string): boolean {
    return siteModuleOf(pathname)?.navbarSticky ?? true;
}

/**
 * Whether a catalogue link points at the page that is open. Exact, so a
 * section link is not marked current while a sub-page of it is open — that is
 * what `aria-current="page"` means.
 */
export function isActive(href: string, pathname: string): boolean {
    if (!href.startsWith('/')) return false;

    return pathnameOf(href) === pathnameOf(pathname);
}

/** The first path segment after `prefix`, e.g. the city id in `/transit/city/<id>`. */
export function routeSegment(pathname: string, prefix: string): string | null {
    const path = pathnameOf(pathname);
    const base = pathnameOf(prefix);
    if (!isUnderPath(path, base) || path === base) return null;

    return path.slice(base.length + 1).split('/')[0] || null;
}
