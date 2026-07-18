import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  fetchGovernmentApps,
  fetchGovernmentStoreIcon,
} from '@/lib/api/directories';
import { governmentAppsFixture } from '@/test/fixtures/directories';

import {
  fetchGovApps,
  fetchStoreIcon,
  getCachedStoreIcon,
  getGovAppScreenshotUrl,
  STORE_ICON_CACHE_MS,
} from './data';
import type { GovApp } from './types';

jest.mock('@/lib/api/directories', () => ({
  ...jest.requireActual('@/lib/api/directories'),
  fetchGovernmentApps: jest.fn(),
  fetchGovernmentStoreIcon: jest.fn(),
}));

const app = governmentAppsFixture[0];

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

test('fetches the validated first-party app directory', async () => {
  expect(app).toBeDefined();
  if (!app) {
    return;
  }
  jest.mocked(fetchGovernmentApps).mockResolvedValue([app]);

  await expect(fetchGovApps()).resolves.toEqual([app]);
  expect(fetchGovernmentApps).toHaveBeenCalledWith({ signal: undefined });
});

test('uses Google Play before Apple for a store icon', async () => {
  expect(app).toBeDefined();
  if (!app) {
    return;
  }
  jest
    .mocked(fetchGovernmentStoreIcon)
    .mockResolvedValueOnce('https://cdn.example.com/play.png');

  await expect(fetchStoreIcon(app)).resolves.toBe(
    'https://cdn.example.com/play.png',
  );
  expect(fetchGovernmentStoreIcon).toHaveBeenCalledTimes(1);
  expect(fetchGovernmentStoreIcon).toHaveBeenCalledWith(
    'play',
    'sy.gov.services',
    { signal: undefined },
  );
});

test('falls back to Apple when Play has no icon', async () => {
  expect(app).toBeDefined();
  if (!app) {
    return;
  }
  jest
    .mocked(fetchGovernmentStoreIcon)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce('https://cdn.example.com/apple.png');

  await expect(fetchStoreIcon(app)).resolves.toBe(
    'https://cdn.example.com/apple.png',
  );
  expect(fetchGovernmentStoreIcon).toHaveBeenNthCalledWith(
    2,
    'apple',
    '123456789',
    { signal: undefined },
  );
});

test('does not cache transient store failures as successful null values', async () => {
  expect(app).toBeDefined();
  if (!app) {
    return;
  }
  jest
    .mocked(fetchGovernmentStoreIcon)
    .mockRejectedValueOnce(new Error('play unavailable'))
    .mockRejectedValueOnce(new Error('apple unavailable'));

  await expect(fetchStoreIcon(app)).rejects.toThrow('play unavailable');
  await expect(getCachedStoreIcon(app.id)).resolves.toBeNull();
});

test('persists successful store icons for seven days', async () => {
  expect(app).toBeDefined();
  if (!app) {
    return;
  }
  jest
    .mocked(fetchGovernmentStoreIcon)
    .mockResolvedValueOnce('https://cdn.example.com/persisted.png');

  await expect(fetchStoreIcon(app)).resolves.toBe(
    'https://cdn.example.com/persisted.png',
  );
  jest.mocked(fetchGovernmentStoreIcon).mockClear();
  await expect(fetchStoreIcon(app)).resolves.toBe(
    'https://cdn.example.com/persisted.png',
  );
  expect(fetchGovernmentStoreIcon).not.toHaveBeenCalled();
});

test('expires persistent icon entries after seven days', async () => {
  expect(app).toBeDefined();
  if (!app) {
    return;
  }
  jest
    .mocked(fetchGovernmentStoreIcon)
    .mockResolvedValueOnce('https://cdn.example.com/expiring.png');
  await fetchStoreIcon(app);

  await expect(
    getCachedStoreIcon(app.id, Date.now() + STORE_ICON_CACHE_MS + 1),
  ).resolves.toBeNull();
});

test('skips store requests when an app has no store links', async () => {
  const noStoreApp: GovApp = {
    description: '',
    icon: '',
    id: 'no-store',
    images: [],
    links: {},
    name: 'No Store',
  };

  await expect(fetchStoreIcon(noStoreApp)).resolves.toBeNull();
  expect(fetchGovernmentStoreIcon).not.toHaveBeenCalled();
  expect(getGovAppScreenshotUrl('/assets/apps/no-store/one.png')).toContain(
    '/assets/apps/no-store/one.png',
  );
});
