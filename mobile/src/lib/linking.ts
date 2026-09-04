import * as Linking from 'expo-linking';

const allowedSchemes = new Set(['http:', 'https:', 'mailto:', 'tel:']);

// Every syrian.zone page that has a native screen, mapped to the route that
// renders it. The website navigates by feature name (/tierlist, /mishwar) while
// the app keeps those screens under /feature/<slug>, so a shared website link
// needs the rewrite below. app.config.ts declares the same key set as Android
// app links, and app.config.test.ts fails when the two drift apart.
const nativeRouteByWebsitePath: Readonly<Record<string, string>> = {
  '/': '/',
  '/about': '/about',
  '/alignment': '/feature/alignment',
  '/board': '/board',
  '/compass': '/feature/compass',
  '/dashboard': '/feature/dashboard',
  '/govapps': '/feature/govapps',
  '/guesswho': '/feature/guesswho',
  '/house': '/feature/house',
  '/justice': '/feature/justice',
  '/mishwar': '/feature/places',
  '/party': '/feature/party',
  '/phonebook': '/feature/phonebook',
  '/polls': '/feature/polls',
  '/population': '/feature/population',
  '/priorities': '/feature/priorities',
  '/privacy': '/feature/privacy',
  '/roznama': '/feature/roznama',
  '/shawarma': '/feature/shawarma',
  '/sites': '/feature/sites',
  '/syid': '/feature/syid',
  '/syofficial': '/feature/syofficial',
  '/syrian-contributors': '/feature/contributors',
  '/terms': '/feature/terms',
  '/tierlist': '/feature/tierlist',
  '/transit': '/transit',
  '/transit/admin': '/transit/admin',
  '/transit/studio': '/transit/studio',
};

// City pages carry ids the table cannot enumerate, and their native routes use
// the identical path (/transit/city/3/map), so they pass through unchanged.
export const websiteLandingPathPrefixes: readonly string[] = ['/transit/city/'];

export const websiteLandingPaths: readonly string[] = Object.keys(
  nativeRouteByWebsitePath,
);

const websiteUrlPattern = /^https?:\/\/(?:www\.)?syrian\.zone(\/[^?#]*)?(.*)$/i;

/**
 * Rewrites an incoming syrian.zone URL to the native route that renders it.
 * Returns null for anything else, including syrianzone:// links, which already
 * address native routes and must be left untouched.
 */
export function resolveWebsiteDeepLink(url: string): string | null {
  const match = websiteUrlPattern.exec(url.trim());
  if (!match) {
    return null;
  }

  // Keep the query and fragment: /polls?slug=x still has to reach the screen.
  const suffix = match[2] ?? '';
  const path = (match[1] ?? '/').replace(/\/+$/, '') || '/';
  const target = nativeRouteByWebsitePath[path];
  if (target) {
    return `${target}${suffix}`;
  }

  return websiteLandingPathPrefixes.some((prefix) => path.startsWith(prefix))
    ? `${path}${suffix}`
    : null;
}

export function isSafeExternalUrl(value: string): boolean {
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return allowedSchemes.has(url.protocol);
  } catch {
    return false;
  }
}

export async function openSafeExternalUrl(value: string): Promise<boolean> {
  if (!isSafeExternalUrl(value)) {
    return false;
  }

  const supported = await Linking.canOpenURL(value);
  if (!supported) {
    return false;
  }

  await Linking.openURL(value);
  return true;
}
