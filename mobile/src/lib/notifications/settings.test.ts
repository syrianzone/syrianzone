import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import {
  anyNotificationEnabled,
  defaultNotificationSettings,
  notificationSettingsKey,
  readNotificationSettings,
  useNotificationSettings,
  writeNotificationSettings,
} from './settings';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('reads both switches as off when nothing is stored', async () => {
  await expect(readNotificationSettings()).resolves.toEqual({
    emergencyWarnings: false,
    rankChanges: false,
  });
});

test('a write merges the patch over the stored settings', async () => {
  await writeNotificationSettings({ emergencyWarnings: true });

  await expect(writeNotificationSettings({ rankChanges: true })).resolves.toEqual({
    emergencyWarnings: true,
    rankChanges: true,
  });
});

test('a write persists the merged settings for the next read', async () => {
  await writeNotificationSettings({ rankChanges: true });

  await expect(AsyncStorage.getItem(notificationSettingsKey)).resolves.toBe(
    '{"emergencyWarnings":false,"rankChanges":true}',
  );
});

test('unparsable stored settings fall back to the defaults', async () => {
  await AsyncStorage.setItem(notificationSettingsKey, '{"rankChanges":"yes"');

  await expect(readNotificationSettings()).resolves.toEqual(
    defaultNotificationSettings,
  );
});

test('stored settings of the wrong shape fall back to the defaults', async () => {
  await AsyncStorage.setItem(notificationSettingsKey, '{"rankChanges":"yes"}');

  await expect(readNotificationSettings()).resolves.toEqual(
    defaultNotificationSettings,
  );
});

test('anyNotificationEnabled is false only when every switch is off', () => {
  expect(anyNotificationEnabled(defaultNotificationSettings)).toBe(false);
});

test('anyNotificationEnabled is true when one switch is on', () => {
  expect(
    anyNotificationEnabled({ emergencyWarnings: false, rankChanges: true }),
  ).toBe(true);
});

test('the hook hydrates from storage', async () => {
  await writeNotificationSettings({ emergencyWarnings: true });

  const { result } = await renderHook(() => useNotificationSettings(), {
    wrapper,
  });

  await waitFor(() =>
    expect(result.current).toMatchObject({
      hydrated: true,
      settings: { emergencyWarnings: true, rankChanges: false },
    }),
  );
});

test('the hook reports the patched settings after an update', async () => {
  const { result } = await renderHook(() => useNotificationSettings(), {
    wrapper,
  });
  await waitFor(() => expect(result.current.hydrated).toBe(true));

  await result.current.update({ rankChanges: true });

  await waitFor(() =>
    expect(result.current.settings).toEqual({
      emergencyWarnings: false,
      rankChanges: true,
    }),
  );
});
