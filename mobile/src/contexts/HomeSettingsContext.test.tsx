import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import type { AuthContextType } from '@/contexts/AuthContext';
import {
  HomeSettingsProvider,
  useHomeSettings,
} from '@/contexts/HomeSettingsContext';
import type { AccountSettingsApi } from '@/lib/auth/accountSettings';
import type { AuthUser } from '@/lib/auth/types';
import {
  defaultHomeSettings,
  homeSettingsSchema,
  type HomeSettings,
} from '@/lib/ported/home';
import { homeSettingsPreferenceKey } from '@/lib/storage/preferences';

let mockAuthContext: AuthContextType | null;

jest.mock('@/contexts/AuthContext', () => ({
  useOptionalAuth: () => mockAuthContext,
}));

function userWithSettings(
  settings: Record<string, unknown>,
  id = 7,
): AuthUser {
  return {
    avatar_url: null,
    email: `user-${id}@example.test`,
    id,
    is_banned: false,
    name: 'User',
    permissions: ['account.settings.update'],
    role: 'user',
    settings,
  };
}

function setAuthenticatedUser(user: AuthUser | null): void {
  mockAuthContext = {
    clearError: jest.fn(),
    error: null,
    isAdmin: false,
    isSuperAdmin: false,
    loading: false,
    login: jest.fn(async () => undefined),
    logout: jest.fn(async () => undefined),
    refreshUser: jest.fn(async () => undefined),
    user,
  };
}

function Probe() {
  const { hydrated, settings, updateSettings } = useHomeSettings();
  return (
    <>
      <Text testID="hydrated">{String(hydrated)}</Text>
      <Text testID="settings">{JSON.stringify(settings)}</Text>
      <Pressable
        testID="change-settings"
        onPress={() =>
          void updateSettings({
            customLinks: [
              {
                icon: '🧭',
                id: 'guide',
                name: 'Guide',
                url: 'https://guide.example/syria',
              },
            ],
            showClock: false,
          })
        }
      />
      <Pressable
        testID="change-governorate-a"
        onPress={() =>
          void updateSettings({ governorate: 'homs' })
        }
      />
      <Pressable
        testID="change-governorate-b"
        onPress={() =>
          void updateSettings({ governorate: 'aleppo' })
        }
      />
    </>
  );
}

function settingsFrom(view: Awaited<ReturnType<typeof render>>): HomeSettings {
  return homeSettingsSchema.parse(
    JSON.parse(String(view.getByTestId('settings').props.children)),
  );
}

async function renderProvider(api: AccountSettingsApi) {
  return render(
    <HomeSettingsProvider accountSettingsApi={api}>
      <Probe />
    </HomeSettingsProvider>,
  );
}

function createApi(
  implementation: AccountSettingsApi['updateSettings'] = jest.fn(
    async (settings) => settings,
  ),
): AccountSettingsApi {
  return { updateSettings: jest.fn(implementation) };
}

function accountDocument(settings: HomeSettings): Record<string, unknown> {
  return {
    clockFormat: settings.clockFormat,
    customLat:
      settings.customCoordinates === null
        ? ''
        : String(settings.customCoordinates.latitude),
    customLinks: settings.customLinks,
    customLon:
      settings.customCoordinates === null
        ? ''
        : String(settings.customCoordinates.longitude),
    customSearchUrl: settings.customSearchUrl,
    governorate: settings.governorate,
    searchEngine: settings.searchEngine,
    showClock: settings.showClock,
    showEvents: settings.showEvents,
    showPrayerTimes: settings.showPrayerTimes,
    showSearch: settings.showSearch,
    showWeather: settings.showWeather,
    useCustomCoords: settings.useCustomCoordinates,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockAuthContext = null;
});

test('adopts and stores a valid authenticated server Home document', async () => {
  const local = homeSettingsSchema.parse({
    governorate: 'aleppo',
    showClock: true,
    showEvents: false,
  });
  const server = homeSettingsSchema.parse({
    ...local,
    customCoordinates: { latitude: 33.5138, longitude: 36.2765 },
    customLinks: [
      {
        icon: '📍',
        id: 'damascus',
        name: 'Damascus',
        url: 'https://example.test/damascus',
      },
    ],
    governorate: 'damascus',
    showClock: false,
    useCustomCoordinates: true,
  });
  await AsyncStorage.setItem(
    homeSettingsPreferenceKey(7),
    JSON.stringify(local),
  );
  setAuthenticatedUser(
    userWithSettings({
      customLat: '33.5138',
      customLinks: server.customLinks,
      customLon: '36.2765',
      governorate: 'damascus',
      showClock: false,
      useCustomCoords: true,
    }),
  );
  const api = createApi();

  const view = await renderProvider(api);

  await waitFor(() => expect(settingsFrom(view)).toEqual(server));
  await waitFor(async () =>
    expect(
      JSON.parse(
        (await AsyncStorage.getItem(homeSettingsPreferenceKey(7))) ?? 'null',
      ),
    ).toEqual(server),
  );
  expect(api.updateSettings).not.toHaveBeenCalled();
});

test('uploads the local Home document when a guest signs in without one', async () => {
  const local = homeSettingsSchema.parse({
    governorate: 'homs',
    showWeather: false,
  });
  await AsyncStorage.setItem(
    'startpage-settings',
    JSON.stringify(local),
  );
  setAuthenticatedUser(null);
  const api = createApi();
  const view = await renderProvider(api);
  await waitFor(() =>
    expect(view.getByTestId('hydrated').props.children).toBe('true'),
  );

  setAuthenticatedUser(userWithSettings({ locale: 'ar' }));
  await act(async () => {
    view.rerender(
      <HomeSettingsProvider accountSettingsApi={api}>
        <Probe />
      </HomeSettingsProvider>,
    );
  });

  await waitFor(() =>
    expect(api.updateSettings).toHaveBeenCalledWith(
      accountDocument(local),
      expect.anything(),
    ),
  );
  expect(settingsFrom(view)).toEqual(local);
});

test('syncs future preference and custom link changes', async () => {
  const server = homeSettingsSchema.parse({ showClock: true });
  setAuthenticatedUser(userWithSettings(accountDocument(server)));
  const api = createApi();
  const view = await renderProvider(api);
  await waitFor(() => expect(settingsFrom(view)).toEqual(server));

  await fireEvent.press(view.getByTestId('change-settings'));

  const expected = homeSettingsSchema.parse({
    ...server,
    customLinks: [
      {
        icon: '🧭',
        id: 'guide',
        name: 'Guide',
        url: 'https://guide.example/syria',
      },
    ],
    showClock: false,
  });
  await waitFor(() =>
    expect(api.updateSettings).toHaveBeenCalledWith(
      accountDocument(expected),
      expect.anything(),
    ),
  );
  await waitFor(async () =>
    expect(
      JSON.parse(
        (await AsyncStorage.getItem(homeSettingsPreferenceKey(7))) ?? 'null',
      ),
    ).toEqual(expected),
  );
});

test('keeps local settings when the server Home document is invalid', async () => {
  const local = homeSettingsSchema.parse({
    governorate: 'latakia',
    showPrayerTimes: false,
  });
  await AsyncStorage.setItem(
    homeSettingsPreferenceKey(7),
    JSON.stringify(local),
  );
  setAuthenticatedUser(
    userWithSettings({
      customLinks: [
        {
          icon: 'x',
          id: 'unsafe',
          name: 'Unsafe',
          url: 'javascript:alert(1)',
        },
      ],
    }),
  );
  const api = createApi();

  const view = await renderProvider(api);

  await waitFor(() =>
    expect(view.getByTestId('hydrated').props.children).toBe('true'),
  );
  expect(settingsFrom(view)).toEqual(local);
  expect(api.updateSettings).not.toHaveBeenCalled();
});

test('keeps offline settings usable when server uploads fail', async () => {
  const local = homeSettingsSchema.parse({ governorate: 'daraa' });
  await AsyncStorage.setItem(
    homeSettingsPreferenceKey(7),
    JSON.stringify(local),
  );
  setAuthenticatedUser(userWithSettings({}));
  const api = createApi(async () => {
    throw new Error('offline');
  });
  const view = await renderProvider(api);

  await waitFor(() =>
    expect(api.updateSettings).toHaveBeenCalledWith(
      accountDocument(local),
      expect.anything(),
    ),
  );
  await fireEvent.press(view.getByTestId('change-settings'));

  await waitFor(() =>
    expect(settingsFrom(view)).toMatchObject({
      customLinks: [expect.objectContaining({ id: 'guide' })],
      showClock: false,
    }),
  );
  await waitFor(async () =>
    expect(
      JSON.parse(
        (await AsyncStorage.getItem(homeSettingsPreferenceKey(7))) ?? 'null',
      ),
    ).toMatchObject({
      customLinks: [expect.objectContaining({ id: 'guide' })],
      showClock: false,
    }),
  );
  expect(api.updateSettings).toHaveBeenCalledTimes(2);
});

test('keeps standalone providers on guest-only local storage behavior', async () => {
  const local = homeSettingsSchema.parse({ governorate: 'raqqa' });
  await AsyncStorage.setItem('startpage-settings', JSON.stringify(local));
  mockAuthContext = null;
  const api = createApi();
  const view = await renderProvider(api);

  await waitFor(() => expect(settingsFrom(view)).toEqual(local));
  await fireEvent.press(view.getByTestId('change-settings'));

  await waitFor(() =>
    expect(settingsFrom(view)).toMatchObject({ showClock: false }),
  );
  expect(api.updateSettings).not.toHaveBeenCalled();
});

test('hydrates account B before syncing after account A signs out', async () => {
  const guest = homeSettingsSchema.parse({ governorate: 'raqqa' });
  const accountA = homeSettingsSchema.parse({
    customCoordinates: { latitude: 33.5138, longitude: 36.2765 },
    customLinks: [
      {
        icon: 'A',
        id: 'account-a',
        name: 'Account A',
        url: 'https://a.example.test',
      },
    ],
    governorate: 'damascus',
    useCustomCoordinates: true,
  });
  const accountB = homeSettingsSchema.parse({
    customCoordinates: { latitude: 36.2021, longitude: 37.1343 },
    customLinks: [
      {
        icon: 'B',
        id: 'account-b',
        name: 'Account B',
        url: 'https://b.example.test',
      },
    ],
    governorate: 'aleppo',
    useCustomCoordinates: true,
  });
  await AsyncStorage.setItem(
    'startpage-settings',
    JSON.stringify(guest),
  );
  await AsyncStorage.setItem(
    homeSettingsPreferenceKey(8),
    JSON.stringify(accountB),
  );
  setAuthenticatedUser(userWithSettings(accountDocument(accountA), 7));
  const api = createApi();
  const view = await renderProvider(api);

  await waitFor(() => expect(settingsFrom(view)).toEqual(accountA));
  setAuthenticatedUser(userWithSettings({ locale: 'ar' }, 8));
  await act(async () => {
    view.rerender(
      <HomeSettingsProvider accountSettingsApi={api}>
        <Probe />
      </HomeSettingsProvider>,
    );
  });

  await waitFor(() => expect(settingsFrom(view)).toEqual(accountB));
  await waitFor(() =>
    expect(api.updateSettings).toHaveBeenCalledWith(
      accountDocument(accountB),
      expect.anything(),
    ),
  );
  expect(api.updateSettings).not.toHaveBeenCalledWith(
    accountDocument(accountA),
    expect.anything(),
  );
});

test('restores the guest profile instead of exposing signed-out account settings', async () => {
  const guest = homeSettingsSchema.parse({
    customLinks: [
      {
        icon: 'G',
        id: 'guest',
        name: 'Guest',
        url: 'https://guest.example.test',
      },
    ],
    governorate: 'raqqa',
  });
  const accountA = homeSettingsSchema.parse({
    customCoordinates: { latitude: 33.5138, longitude: 36.2765 },
    customLinks: [
      {
        icon: 'A',
        id: 'account-a',
        name: 'Account A',
        url: 'https://a.example.test',
      },
    ],
    governorate: 'damascus',
    useCustomCoordinates: true,
  });
  await AsyncStorage.setItem(
    'startpage-settings',
    JSON.stringify(guest),
  );
  setAuthenticatedUser(userWithSettings(accountDocument(accountA), 7));
  const api = createApi();
  const view = await renderProvider(api);

  await waitFor(() => expect(settingsFrom(view)).toEqual(accountA));
  setAuthenticatedUser(null);
  await act(async () => {
    view.rerender(
      <HomeSettingsProvider accountSettingsApi={api}>
        <Probe />
      </HomeSettingsProvider>,
    );
  });

  await waitFor(() => expect(settingsFrom(view)).toEqual(guest));
  expect(api.updateSettings).not.toHaveBeenCalled();
});

test('aborts an account upload before the next account can supply credentials', async () => {
  const accountA = homeSettingsSchema.parse({
    customCoordinates: { latitude: 33.5138, longitude: 36.2765 },
    customLinks: [
      {
        icon: 'A',
        id: 'account-a',
        name: 'Account A',
        url: 'https://a.example.test',
      },
    ],
    useCustomCoordinates: true,
  });
  const accountB = homeSettingsSchema.parse({
    governorate: 'aleppo',
  });
  await AsyncStorage.setItem(
    homeSettingsPreferenceKey(7),
    JSON.stringify(accountA),
  );
  setAuthenticatedUser(userWithSettings({}, 7));
  let resolveUpload: (settings: Record<string, unknown>) => void =
    () => undefined;
  const pendingUpload = new Promise<Record<string, unknown>>((resolve) => {
    resolveUpload = resolve;
  });
  const api = createApi(() => pendingUpload);
  const updateSettings = api.updateSettings as jest.MockedFunction<
    AccountSettingsApi['updateSettings']
  >;
  const view = await renderProvider(api);

  await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
  const accountASignal = updateSettings.mock.calls[0]?.[1];
  expect(accountASignal).toBeDefined();
  expect(accountASignal?.aborted).toBe(false);

  setAuthenticatedUser(
    userWithSettings(accountDocument(accountB), 8),
  );
  await act(async () => {
    view.rerender(
      <HomeSettingsProvider accountSettingsApi={api}>
        <Probe />
      </HomeSettingsProvider>,
    );
  });

  await waitFor(() => expect(settingsFrom(view)).toEqual(accountB));
  expect(accountASignal?.aborted).toBe(true);
  expect(updateSettings).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolveUpload(accountDocument(accountA));
    await pendingUpload;
  });
});

test('does not import an unclaimed legacy account profile into account B', async () => {
  const accountA = homeSettingsSchema.parse({
    customCoordinates: { latitude: 33.5138, longitude: 36.2765 },
    customLinks: [
      {
        icon: 'A',
        id: 'account-a',
        name: 'Account A',
        url: 'https://a.example.test',
      },
    ],
    governorate: 'damascus',
    useCustomCoordinates: true,
  });
  await AsyncStorage.setItem(
    'startpage-settings',
    JSON.stringify(accountA),
  );
  setAuthenticatedUser(
    userWithSettings(accountDocument(accountA), 7),
  );
  const api = createApi();
  const view = await renderProvider(api);

  await waitFor(() => expect(settingsFrom(view)).toEqual(accountA));
  jest.mocked(api.updateSettings).mockClear();
  setAuthenticatedUser(userWithSettings({}, 8));
  await act(async () => {
    view.rerender(
      <HomeSettingsProvider accountSettingsApi={api}>
        <Probe />
      </HomeSettingsProvider>,
    );
  });

  await waitFor(() =>
    expect(settingsFrom(view)).toEqual(defaultHomeSettings),
  );
  await waitFor(() =>
    expect(api.updateSettings).toHaveBeenCalledWith(
      accountDocument(defaultHomeSettings),
      expect.anything(),
    ),
  );
  expect(api.updateSettings).not.toHaveBeenCalledWith(
    accountDocument(accountA),
    expect.anything(),
  );
});

test('serializes rapid account updates and sends the latest snapshot last', async () => {
  const server = homeSettingsSchema.parse({ governorate: 'damascus' });
  setAuthenticatedUser(userWithSettings(accountDocument(server), 7));
  const pendingResolvers: ((
    settings: Record<string, unknown>,
  ) => void)[] = [];
  const api = createApi(
    (settings) =>
      new Promise((resolve) => {
        pendingResolvers.push(() => resolve(settings));
      }),
  );
  const updateSettings = api.updateSettings as jest.MockedFunction<
    AccountSettingsApi['updateSettings']
  >;
  const view = await renderProvider(api);
  await waitFor(() => expect(settingsFrom(view)).toEqual(server));

  await fireEvent.press(view.getByTestId('change-governorate-a'));
  await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
  await fireEvent.press(view.getByTestId('change-governorate-b'));

  expect(settingsFrom(view).governorate).toBe('aleppo');
  expect(updateSettings).toHaveBeenCalledTimes(1);

  await act(async () => {
    pendingResolvers[0]?.(updateSettings.mock.calls[0]![0]);
  });
  await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(2));
  expect(updateSettings.mock.calls[1]?.[0]).toEqual(
    accountDocument(
      homeSettingsSchema.parse({
        ...server,
        governorate: 'aleppo',
      }),
    ),
  );
  await act(async () => {
    pendingResolvers[1]?.(updateSettings.mock.calls[1]![0]);
  });
});
