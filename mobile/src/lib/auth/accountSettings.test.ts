import type { ApiClient, ApiRequestOptions } from '@/lib/api/client';
import { homeSettingsSchema } from '@/lib/ported/home';

import {
  createAccountSettingsApi,
  fromAccountHomeSettings,
  hasAccountHomeSettings,
  toAccountHomeSettings,
} from './accountSettings';

interface ClientCall {
  options: ApiRequestOptions<unknown>;
  path: string;
}

function createClient() {
  const calls: ClientCall[] = [];
  const responses: unknown[] = [];
  const client: ApiClient = {
    async request<T>(path: string, options: ApiRequestOptions<T>): Promise<T> {
      calls.push({
        options: options as ApiRequestOptions<unknown>,
        path,
      });
      return options.schema.parse(responses.shift());
    },
  };

  return { calls, client, responses };
}

test('patches flat source-compatible keys through the account settings contract', async () => {
  const { calls, client, responses } = createClient();
  const controller = new AbortController();
  const settings = {
    clockFormat: '24',
    customLat: '',
    customLinks: [
      {
        icon: '🧭',
        id: 'guide',
        name: 'Guide',
        url: 'https://guide.example/syria',
      },
    ],
    customLon: '',
    customSearchUrl: '',
    governorate: 'damascus',
    searchEngine: 'duckduckgo',
    showClock: false,
    showEvents: true,
    showPrayerTimes: true,
    showSearch: true,
    showWeather: true,
    useCustomCoords: false,
  };
  const mergedSettings = { ...settings, language: 'ar' };
  responses.push({ data: { settings: mergedSettings } });

  await expect(
    createAccountSettingsApi(client).updateSettings(
      settings,
      controller.signal,
    ),
  ).resolves.toEqual(mergedSettings);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    options: {
      body: { settings },
      method: 'PATCH',
    },
    path: '/api/mobile/account/settings',
  });
  expect(calls[0]?.options.signal).toBe(controller.signal);
});

test('converts native Home settings to every source-compatible flat key', () => {
  const home = homeSettingsSchema.parse({
    customCoordinates: { latitude: 33.5138, longitude: 36.2765 },
    customLinks: [
      {
        icon: '🧭',
        id: 'guide',
        name: 'Guide',
        url: 'https://guide.example/syria',
      },
    ],
    showClock: false,
    useCustomCoordinates: true,
  });

  expect(toAccountHomeSettings(home)).toEqual({
    clockFormat: '24',
    customLat: '33.5138',
    customLinks: [
      {
        icon: '🧭',
        id: 'guide',
        name: 'Guide',
        url: 'https://guide.example/syria',
      },
    ],
    customLon: '36.2765',
    customSearchUrl: '',
    governorate: 'damascus',
    searchEngine: 'duckduckgo',
    showClock: false,
    showEvents: true,
    showPrayerTimes: true,
    showSearch: true,
    showWeather: true,
    useCustomCoords: true,
  });
});

test('overlays valid flat server keys and converts source coordinates', () => {
  const local = homeSettingsSchema.parse({
    governorate: 'aleppo',
    showEvents: false,
  });

  expect(
    fromAccountHomeSettings(
      {
        customLat: '34.889',
        customLon: '35.8866',
        governorate: 'tartus',
        showClock: false,
        useCustomCoords: true,
      },
      local,
    ),
  ).toEqual(
    homeSettingsSchema.parse({
      ...local,
      customCoordinates: { latitude: 34.889, longitude: 35.8866 },
      governorate: 'tartus',
      showClock: false,
      useCustomCoordinates: true,
    }),
  );
});

test('detects missing and invalid source Home documents', () => {
  const local = homeSettingsSchema.parse({ governorate: 'idlib' });

  expect(hasAccountHomeSettings({ language: 'ar' })).toBe(false);
  expect(hasAccountHomeSettings({ showClock: false })).toBe(true);
  expect(fromAccountHomeSettings({ language: 'ar' }, local)).toBeNull();
  expect(
    fromAccountHomeSettings(
      {
        customLat: 'not-a-coordinate',
        customLon: '36.2',
        useCustomCoords: true,
      },
      local,
    ),
  ).toBeNull();
  expect(
    fromAccountHomeSettings(
      {
        customLat: '',
        customLon: '36.2',
        useCustomCoords: true,
      },
      local,
    ),
  ).toBeNull();
});

test('rejects a malformed account settings response', async () => {
  const { client, responses } = createClient();
  responses.push({ settings: {} });

  await expect(
    createAccountSettingsApi(client).updateSettings({ showClock: false }),
  ).rejects.toBeTruthy();
});
