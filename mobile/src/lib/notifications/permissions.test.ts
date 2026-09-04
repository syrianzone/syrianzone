import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { ensureChannels, ensureNotificationPermission } from './permissions';

const getPermissionsAsync = jest.mocked(Notifications.getPermissionsAsync);
const requestPermissionsAsync = jest.mocked(
  Notifications.requestPermissionsAsync,
);
const setNotificationChannelAsync = jest.mocked(
  Notifications.setNotificationChannelAsync,
);

// The mocked module returns plain objects, so the status enum is filled in by hand.
function permission(granted: boolean) {
  return {
    canAskAgain: true,
    expires: 'never',
    granted,
    status: granted ? 'granted' : 'denied',
  } as unknown as Notifications.NotificationPermissionsStatus;
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('a permission already granted is not asked for again', async () => {
  await expect(ensureNotificationPermission()).resolves.toBe(true);

  expect(requestPermissionsAsync).not.toHaveBeenCalled();
});

test('a permission never asked for prompts the user', async () => {
  getPermissionsAsync.mockResolvedValueOnce(permission(false));

  await ensureNotificationPermission();

  expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
});

test('a refused prompt reports that notifications cannot be shown', async () => {
  getPermissionsAsync.mockResolvedValueOnce(permission(false));
  requestPermissionsAsync.mockResolvedValueOnce(permission(false));

  await expect(ensureNotificationPermission()).resolves.toBe(false);
});

test('the android channels are created once however often they are ensured', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');

  await ensureChannels();
  await ensureChannels();

  expect(setNotificationChannelAsync.mock.calls.map(([id]) => id)).toEqual([
    'alerts',
    'updates',
  ]);
});
