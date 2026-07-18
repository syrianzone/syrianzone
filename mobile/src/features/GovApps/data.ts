import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  fetchGovernmentApps as fetchDirectoryGovernmentApps,
  fetchGovernmentStoreIcon,
  resolveDirectoryImageUrl,
} from '@/lib/api/directories';

import type { GovApp } from './types';

export const STORE_ICON_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const STORE_ICON_CACHE_KEY = 'sz_app_icons_v1';

interface StoreIconCacheEntry {
  icon: string;
  timestamp: number;
}

type StoreIconCache = Record<string, StoreIconCacheEntry>;

async function readStoreIconCache(): Promise<StoreIconCache> {
  try {
    const raw = await AsyncStorage.getItem(STORE_ICON_CACHE_KEY);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const cache: StoreIconCache = {};
    for (const [appId, candidate] of Object.entries(parsed)) {
      if (
        candidate &&
        typeof candidate === 'object' &&
        'icon' in candidate &&
        'timestamp' in candidate &&
        typeof candidate.icon === 'string' &&
        typeof candidate.timestamp === 'number'
      ) {
        cache[appId] = {
          icon: candidate.icon,
          timestamp: candidate.timestamp,
        };
      }
    }
    return cache;
  } catch {
    return {};
  }
}

async function writeStoreIconCache(cache: StoreIconCache): Promise<void> {
  try {
    await AsyncStorage.setItem(STORE_ICON_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Icon persistence is optional because first-party media remains available.
  }
}

export async function getCachedStoreIcon(
  appId: string,
  now = Date.now(),
): Promise<string | null> {
  const cache = await readStoreIconCache();
  const entry = cache[appId];
  if (!entry) {
    return null;
  }
  if (now - entry.timestamp > STORE_ICON_CACHE_MS) {
    delete cache[appId];
    await writeStoreIconCache(cache);
    return null;
  }
  return resolveDirectoryImageUrl(entry.icon);
}

async function cacheStoreIcon(appId: string, icon: string): Promise<void> {
  const normalized = resolveDirectoryImageUrl(icon);
  if (!normalized) {
    return;
  }
  const cache = await readStoreIconCache();
  cache[appId] = { icon: normalized, timestamp: Date.now() };
  await writeStoreIconCache(cache);
}

export async function fetchGovApps(signal?: AbortSignal): Promise<GovApp[]> {
  return fetchDirectoryGovernmentApps({ signal });
}

export function extractAppleAppId(url: string): string | null {
  return url.match(/id(\d+)/)?.[1] ?? null;
}

export function extractGooglePlayPackage(url: string): string | null {
  return url.match(/[?&]id=([^&]+)/)?.[1] ?? null;
}

export async function fetchStoreIcon(
  app: GovApp,
  signal?: AbortSignal,
): Promise<string | null> {
  const cached = await getCachedStoreIcon(app.id);
  if (cached) {
    return cached;
  }

  let requestError: unknown;
  const packageName = app.links.android
    ? extractGooglePlayPackage(app.links.android)
    : null;
  if (packageName) {
    try {
      const icon = await fetchGovernmentStoreIcon('play', packageName, {
        signal,
      });
      if (icon) {
        await cacheStoreIcon(app.id, icon);
        return icon;
      }
    } catch (error) {
      requestError = error;
    }
  }

  const appleId = app.links.apple ? extractAppleAppId(app.links.apple) : null;
  if (appleId) {
    try {
      const icon = await fetchGovernmentStoreIcon('apple', appleId, { signal });
      if (icon) {
        await cacheStoreIcon(app.id, icon);
        return icon;
      }
    } catch (error) {
      requestError ??= error;
    }
  }

  if (requestError) {
    throw requestError;
  }
  return null;
}

export function getGovAppIconUrl(
  app: GovApp,
  storeIcon?: null | string,
): string | null {
  return resolveDirectoryImageUrl(storeIcon || app.icon);
}

export function getGovAppScreenshotUrl(value: string): string | null {
  return resolveDirectoryImageUrl(value);
}

/*
PORT STATUS
  source:     resources/js/Pages/GovApps/data.ts (103 lines)
  confidence: high
  todos:      0
  notes:      Filesystem discovery moved server-side and store icons use bounded query caching.
*/
