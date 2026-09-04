import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import mockNetInfo from '@react-native-community/netinfo/jest/netinfo-mock';
import { notifyManager } from '@tanstack/react-query';
import { act } from 'react';

notifyManager.setNotifyFunction((callback) => {
  const previous = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    act(() => {
      callback();
    });
  } finally {
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('@react-native-community/netinfo', () => mockNetInfo);

jest.mock('lucide-react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );
  const Icon = (props: object) => React.createElement(View, props);

  return new Proxy(
    { __esModule: true },
    {
      get: (target, property) => Reflect.get(target, property) ?? Icon,
    },
  );
});

const mockSecureValues = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureValues.delete(key);
  }),
  getItemAsync: jest.fn(
    async (key: string) => mockSecureValues.get(key) ?? null,
  ),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureValues.set(key, value);
  }),
}));

beforeEach(() => {
  mockSecureValues.clear();
});

const grantedPermission = {
  canAskAgain: true,
  expires: 'never',
  granted: true,
  status: 'granted',
};

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 5, MAX: 7 },
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => grantedPermission),
  requestPermissionsAsync: jest.fn(async () => grantedPermission),
  scheduleNotificationAsync: jest.fn(async () => 'notification-id'),
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationHandler: jest.fn(),
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskDefined: jest.fn(() => false),
  isTaskRegisteredAsync: jest.fn(async () => false),
}));

jest.mock('expo-background-task', () => ({
  BackgroundTaskResult: { Failed: 2, Success: 1 },
  BackgroundTaskStatus: { Available: 2, Restricted: 1 },
  getStatusAsync: jest.fn(async () => 2),
  registerTaskAsync: jest.fn(async () => undefined),
  unregisterTaskAsync: jest.fn(async () => undefined),
}));
