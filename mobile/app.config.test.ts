import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { ConfigContext } from 'expo/config';

import {
  resolveWebsiteDeepLink,
  websiteLandingPathPrefixes,
  websiteLandingPaths,
} from '@/lib/linking';

import createAppConfig, {
  websiteAppLinkPathPrefixes,
  websiteAppLinkPaths,
} from './app.config';

jest.mock('./plugins/withDataChannelWebRtc.js', () => ({
  withDataChannelWebRtc: (config: unknown) => config,
}));

function appConfig() {
  return createAppConfig({
    config: {
      name: 'fixture',
      slug: 'fixture',
    },
  } as ConfigContext);
}

function websiteLinkFilter() {
  const filter = appConfig().android?.intentFilters?.find(
    (entry) => entry.action === 'VIEW',
  );
  if (!filter) {
    throw new Error('The Android VIEW intent filter is missing');
  }
  return filter;
}

function intentFilterData() {
  const { data } = websiteLinkFilter();
  return Array.isArray(data) ? data : data ? [data] : [];
}

const appDirectory = resolve(__dirname, 'src/app');

// A native landing is a route file that expo-router can resolve, or a slug the
// /feature/[slug] switch answers.
function hasNativeLanding(route: string): boolean {
  if (route.startsWith('/feature/')) {
    const slug = route.slice('/feature/'.length);
    const featureRoute = readFileSync(
      resolve(appDirectory, 'feature/[slug].tsx'),
      'utf8',
    );
    return featureRoute.includes(`case '${slug}':`);
  }

  const file = route === '/' ? 'index' : route.slice(1);
  return (
    existsSync(resolve(appDirectory, `${file}.tsx`)) ||
    existsSync(resolve(appDirectory, `${file}/index.tsx`))
  );
}

function websiteNavbarPaths(): readonly string[] {
  const navbar = readFileSync(
    resolve(__dirname, '../resources/js/Components/Navbar.tsx'),
    'utf8',
  );
  const paths = [
    ...navbar.matchAll(/href: '(\/[^']*)'/g),
    ...navbar.matchAll(/href="(\/[^"]*)"/g),
  ].map((match) => match[1] ?? '');

  // /auth/* is the server's OAuth handoff, which the app replaces with
  // expo-auth-session rather than a screen of its own.
  return [...new Set(paths)].filter((path) => !path.startsWith('/auth/'));
}

test('registers one stable native auth scheme', () => {
  expect(appConfig().scheme).toBe('syrianzone');
});

test('declares deterministic native build identities', () => {
  const config = appConfig();

  expect(config.ios?.buildNumber).toBe('1');
  expect(config.android?.versionCode).toBe(1);
});

test('blocks the unused Android system overlay permission', () => {
  expect(appConfig().android?.blockedPermissions).toContain(
    'android.permission.SYSTEM_ALERT_WINDOW',
  );
});

test('configures local notification icon, tint, and default channel', () => {
  expect(appConfig().plugins).toContainEqual([
    'expo-notifications',
    {
      color: '#5a714a',
      defaultChannel: 'updates',
      icon: './assets/images/icon-monochrome.png',
    },
  ]);
});

test('enables iOS background processing for notification checks', () => {
  expect(appConfig().plugins).toContain('expo-background-task');
});

test('claims https://syrian.zone links with a browsable Android app link', () => {
  const filter = websiteLinkFilter();

  expect(filter.category).toEqual(['BROWSABLE', 'DEFAULT']);
  // Verification needs assetlinks.json on the website, so the app stays in the
  // chooser instead of silently losing every link to the browser.
  expect(filter.autoVerify).toBe(false);
  for (const entry of intentFilterData()) {
    expect(entry).toMatchObject({ host: 'syrian.zone', scheme: 'https' });
  }
});

test('declares one app link per website path the app can render', () => {
  const paths = intentFilterData()
    .map((entry) => entry.path)
    .filter((path) => path !== undefined);
  const prefixes = intentFilterData()
    .map((entry) => entry.pathPrefix)
    .filter((prefix) => prefix !== undefined);

  expect(paths).toEqual([...websiteAppLinkPaths]);
  expect(prefixes).toEqual([...websiteAppLinkPathPrefixes]);
});

test('keeps the app link paths and the deep link rewrites in sync', () => {
  expect([...websiteAppLinkPaths].sort()).toEqual([...websiteLandingPaths].sort());
  expect([...websiteAppLinkPathPrefixes]).toEqual([
    ...websiteLandingPathPrefixes,
  ]);
});

test('routes every declared app link to a native landing', () => {
  for (const path of websiteAppLinkPaths) {
    const route = resolveWebsiteDeepLink(`https://syrian.zone${path}`);

    expect(route).not.toBeNull();
    expect(route && hasNativeLanding(route)).toBe(true);
  }
});

test('gives every website navbar path a native landing', () => {
  const paths = websiteNavbarPaths();

  expect(paths.length).toBeGreaterThan(15);
  for (const path of paths) {
    const route = resolveWebsiteDeepLink(`https://syrian.zone${path}`);

    expect([path, route]).toEqual([path, expect.any(String)]);
    expect([path, route && hasNativeLanding(route)]).toEqual([path, true]);
  }
});
