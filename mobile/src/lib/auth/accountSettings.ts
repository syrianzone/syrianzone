import { z } from 'zod';

import { apiClient, type ApiClient } from '@/lib/api/client';
import {
  customLinkSchema,
  homeCoordinatesSchema,
  homeSettingsSchema,
  searchEngines,
  type HomeSettings,
} from '@/lib/ported/home';

const settingsSchema = z.record(z.string(), z.unknown());
const accountSettingsResponseSchema = z.object({
  data: z.object({
    settings: settingsSchema,
  }),
});
const accountHomeSettingsSchema = z.object({
  clockFormat: z.enum(['12', '24']).optional(),
  customLat: z.string().max(32).optional(),
  customLinks: z.array(customLinkSchema).max(24).optional(),
  customLon: z.string().max(32).optional(),
  customSearchUrl: z.string().trim().max(2048).optional(),
  governorate: z.string().optional(),
  searchEngine: z.enum(searchEngines).optional(),
  showClock: z.boolean().optional(),
  showEvents: z.boolean().optional(),
  showPrayerTimes: z.boolean().optional(),
  showSearch: z.boolean().optional(),
  showWeather: z.boolean().optional(),
  useCustomCoords: z.boolean().optional(),
});
const accountHomeSettingKeys = [
  'clockFormat',
  'customLat',
  'customLinks',
  'customLon',
  'customSearchUrl',
  'governorate',
  'searchEngine',
  'showClock',
  'showEvents',
  'showPrayerTimes',
  'showSearch',
  'showWeather',
  'useCustomCoords',
] as const;

export type AccountSettings = z.infer<typeof settingsSchema>;
export interface AccountHomeSettings extends Record<string, unknown> {
  clockFormat: HomeSettings['clockFormat'];
  customLat: string;
  customLinks: HomeSettings['customLinks'];
  customLon: string;
  customSearchUrl: string;
  governorate: string;
  searchEngine: HomeSettings['searchEngine'];
  showClock: boolean;
  showEvents: boolean;
  showPrayerTimes: boolean;
  showSearch: boolean;
  showWeather: boolean;
  useCustomCoords: boolean;
}

export interface AccountSettingsApi {
  updateSettings: (
    settings: AccountSettings,
    signal?: AbortSignal,
  ) => Promise<AccountSettings>;
}

export function createAccountSettingsApi(
  client: ApiClient = apiClient,
): AccountSettingsApi {
  return {
    async updateSettings(settings, signal) {
      const response = await client.request('/api/mobile/account/settings', {
        body: { settings },
        method: 'PATCH',
        schema: accountSettingsResponseSchema,
        signal,
      });
      return response.data.settings;
    },
  };
}

export function hasAccountHomeSettings(settings: AccountSettings): boolean {
  return accountHomeSettingKeys.some((key) =>
    Object.prototype.hasOwnProperty.call(settings, key),
  );
}

export function fromAccountHomeSettings(
  settings: AccountSettings,
  fallback: HomeSettings,
): HomeSettings | null {
  if (!hasAccountHomeSettings(settings)) {
    return null;
  }
  const parsed = accountHomeSettingsSchema.safeParse(settings);
  if (!parsed.success) {
    return null;
  }
  const source = parsed.data;
  let customCoordinates = fallback.customCoordinates;
  if (source.customLat !== undefined || source.customLon !== undefined) {
    const customLat =
      source.customLat ??
      (fallback.customCoordinates === null
        ? ''
        : String(fallback.customCoordinates.latitude));
    const customLon =
      source.customLon ??
      (fallback.customCoordinates === null
        ? ''
        : String(fallback.customCoordinates.longitude));
    const hasCustomLat = customLat.trim().length > 0;
    const hasCustomLon = customLon.trim().length > 0;
    if (!hasCustomLat && !hasCustomLon) {
      customCoordinates = null;
    } else if (!hasCustomLat || !hasCustomLon) {
      return null;
    } else {
      const coordinates = homeCoordinatesSchema.safeParse({
        latitude: Number(customLat),
        longitude: Number(customLon),
      });
      if (!coordinates.success) {
        return null;
      }
      customCoordinates = coordinates.data;
    }
  }

  const home = homeSettingsSchema.safeParse({
    ...fallback,
    ...(source.clockFormat === undefined
      ? {}
      : { clockFormat: source.clockFormat }),
    ...(source.customLinks === undefined
      ? {}
      : { customLinks: source.customLinks }),
    ...(source.customSearchUrl === undefined
      ? {}
      : { customSearchUrl: source.customSearchUrl }),
    ...(source.governorate === undefined
      ? {}
      : { governorate: source.governorate }),
    ...(source.searchEngine === undefined
      ? {}
      : { searchEngine: source.searchEngine }),
    ...(source.showClock === undefined
      ? {}
      : { showClock: source.showClock }),
    ...(source.showEvents === undefined
      ? {}
      : { showEvents: source.showEvents }),
    ...(source.showPrayerTimes === undefined
      ? {}
      : { showPrayerTimes: source.showPrayerTimes }),
    ...(source.showSearch === undefined
      ? {}
      : { showSearch: source.showSearch }),
    ...(source.showWeather === undefined
      ? {}
      : { showWeather: source.showWeather }),
    ...(source.useCustomCoords === undefined
      ? {}
      : { useCustomCoordinates: source.useCustomCoords }),
    customCoordinates,
  });
  return home.success ? home.data : null;
}

export function toAccountHomeSettings(
  settings: HomeSettings,
): AccountHomeSettings {
  const home = homeSettingsSchema.parse(settings);
  return {
    clockFormat: home.clockFormat,
    customLat:
      home.customCoordinates === null
        ? ''
        : String(home.customCoordinates.latitude),
    customLinks: home.customLinks,
    customLon:
      home.customCoordinates === null
        ? ''
        : String(home.customCoordinates.longitude),
    customSearchUrl: home.customSearchUrl,
    governorate: home.governorate,
    searchEngine: home.searchEngine,
    showClock: home.showClock,
    showEvents: home.showEvents,
    showPrayerTimes: home.showPrayerTimes,
    showSearch: home.showSearch,
    showWeather: home.showWeather,
    useCustomCoords: home.useCustomCoordinates,
  };
}

export const accountSettingsApi = createAccountSettingsApi();
