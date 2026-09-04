import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { createElement, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { registerBackgroundChecks, runForegroundCheck } from './background';
import { featureRouteFor, useNotificationLifecycle } from './index';
import { writeNotificationSettings } from './settings';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('./background', () => ({
  NOTIFICATIONS_TASK: 'sz-notification-checks',
  defineNotificationTask: jest.fn(),
  registerBackgroundChecks: jest.fn(async () => undefined),
  runForegroundCheck: jest.fn(async () => 0),
}));

const addResponseListener = jest.mocked(
  Notifications.addNotificationResponseReceivedListener,
);
const setNotificationChannelAsync = jest.mocked(
  Notifications.setNotificationChannelAsync,
);
const setNotificationHandler = jest.mocked(Notifications.setNotificationHandler);
const push = jest.mocked(router.push);

let responseCount = 0;

function response(feature: string) {
  responseCount += 1;
  return {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: {
      date: 0,
      request: {
        content: { data: { feature } },
        identifier: `response-${responseCount}`,
      },
    },
  } as unknown as Notifications.NotificationResponse;
}

function tapListener() {
  const call = addResponseListener.mock.calls[0];
  if (!call) {
    throw new Error('the lifecycle never subscribed to notification taps');
  }
  return call[0];
}

function presentationHandler() {
  const call = setNotificationHandler.mock.calls[0];
  if (!call) {
    throw new Error('the lifecycle never set a presentation handler');
  }
  return call[0];
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

async function mountLifecycle() {
  const view = await renderHook(() => useNotificationLifecycle(), { wrapper });
  await waitFor(() => expect(registerBackgroundChecks).toHaveBeenCalled());
  return view;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('mounting installs the foreground presentation handler', async () => {
  await mountLifecycle();

  expect(setNotificationHandler).toHaveBeenCalledTimes(1);
});

test('the handler shows the notification as a banner and in the list', async () => {
  await mountLifecycle();
  const handler = presentationHandler();

  await expect(
    handler?.handleNotification(response('warnings').notification),
  ).resolves.toMatchObject({ shouldShowBanner: true, shouldShowList: true });
});

test('mounting creates the android channels', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');

  await mountLifecycle();

  await waitFor(() =>
    expect(setNotificationChannelAsync.mock.calls.map(([id]) => id)).toEqual([
      'alerts',
      'updates',
    ]),
  );
});

test('mounting runs a throttled foreground check with the stored settings', async () => {
  await writeNotificationSettings({ rankChanges: true });

  await mountLifecycle();

  await waitFor(() =>
    expect(runForegroundCheck).toHaveBeenCalledWith({
      settings: { emergencyWarnings: false, rankChanges: true },
    }),
  );
});

test('mounting hands the stored settings to the background registration', async () => {
  await writeNotificationSettings({ emergencyWarnings: true });

  await mountLifecycle();

  await waitFor(() =>
    expect(registerBackgroundChecks).toHaveBeenCalledWith({
      emergencyWarnings: true,
      rankChanges: false,
    }),
  );
});

test('tapping a warnings notification opens the warnings screen', async () => {
  await mountLifecycle();

  tapListener()(response('warnings'));

  expect(push).toHaveBeenCalledWith('/feature/warnings');
});

test('the same tap is never routed twice', async () => {
  await mountLifecycle();
  const tapped = response('tierlist');

  const onTap = tapListener();
  onTap(tapped);
  onTap(tapped);

  expect(push).toHaveBeenCalledTimes(1);
});

test('a notification for an unknown feature routes nowhere', () => {
  expect(featureRouteFor({ feature: 'weather' })).toBeNull();
});

test('a notification without data routes nowhere', () => {
  expect(featureRouteFor(undefined)).toBeNull();
});
