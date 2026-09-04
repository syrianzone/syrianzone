import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  presentedIdsKey,
  presentedIdsLimit,
  registerChecker,
  registeredCheckers,
  runCheckers,
  type NotificationChecker,
  type NotificationPayload,
} from './checkers';
import type { NotificationSettings } from './settings';

const scheduleNotificationAsync = jest.mocked(
  Notifications.scheduleNotificationAsync,
);

const ranksOnly: NotificationSettings = {
  emergencyWarnings: false,
  rankChanges: true,
};

function payload(id: string): NotificationPayload {
  return { body: `body ${id}`, id, title: `title ${id}` };
}

function checker(
  id: string,
  run: NotificationChecker['run'],
  overrides: Partial<NotificationChecker> = {},
): NotificationChecker {
  return {
    channelId: 'updates',
    id,
    run,
    settingKey: 'rankChanges',
    ...overrides,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  scheduleNotificationAsync.mockClear();
});

// Platform.OS is replaced per test, so it has to go back to the default for the next one.
afterEach(() => {
  jest.restoreAllMocks();
});

test('the registry replaces a checker that registers twice under one id', () => {
  const first = checker('duplicate', async () => []);
  const second = checker('duplicate', async () => []);

  registerChecker(first);
  registerChecker(second);

  expect(registeredCheckers().filter(({ id }) => id === 'duplicate')).toEqual([
    second,
  ]);
});

test('a checker whose setting is off never runs', async () => {
  const run = jest.fn(async () => [payload('warning-1')]);

  await runCheckers({
    checkers: [checker('warnings', run, { settingKey: 'emergencyWarnings' })],
    settings: ranksOnly,
  });

  expect(run).not.toHaveBeenCalled();
});

test('every payload of an enabled checker is presented', async () => {
  await runCheckers({
    checkers: [
      checker('ranks', async () => [payload('rank-1'), payload('rank-2')]),
    ],
    settings: ranksOnly,
  });

  expect(scheduleNotificationAsync).toHaveBeenCalledTimes(2);
});

test('a payload is presented on the channel its checker declares', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');

  await runCheckers({
    checkers: [
      checker('warnings', async () => [payload('warning-1')], {
        channelId: 'alerts',
        settingKey: 'emergencyWarnings',
      }),
    ],
    settings: { emergencyWarnings: true, rankChanges: false },
  });

  expect(scheduleNotificationAsync).toHaveBeenCalledWith({
    content: { body: 'body warning-1', data: undefined, title: 'title warning-1' },
    trigger: { channelId: 'alerts' },
  });
});

test('an id presented once is never presented again', async () => {
  const checkers = [checker('ranks', async () => [payload('rank-1')])];

  await runCheckers({ checkers, settings: ranksOnly });
  scheduleNotificationAsync.mockClear();

  await expect(runCheckers({ checkers, settings: ranksOnly })).resolves.toBe(0);
  expect(scheduleNotificationAsync).not.toHaveBeenCalled();
});

test('a checker that throws does not stop the ones after it', async () => {
  const presented = await runCheckers({
    checkers: [
      checker('broken', async () => {
        throw new Error('offline');
      }),
      checker('ranks', async () => [payload('rank-1')]),
    ],
    settings: ranksOnly,
  });

  expect(presented).toBe(1);
});

test('a failed presentation is retried on the next run', async () => {
  const checkers = [checker('ranks', async () => [payload('rank-1')])];
  scheduleNotificationAsync.mockRejectedValueOnce(new Error('no permission'));

  await runCheckers({ checkers, settings: ranksOnly });

  await expect(runCheckers({ checkers, settings: ranksOnly })).resolves.toBe(1);
});

test('the presented id store keeps only its documented size', async () => {
  const ids = Array.from({ length: presentedIdsLimit + 5 }, (_, index) =>
    payload(`rank-${index}`),
  );

  await runCheckers({
    checkers: [checker('ranks', async () => ids)],
    settings: ranksOnly,
  });

  const stored: string[] = JSON.parse(
    (await AsyncStorage.getItem(presentedIdsKey)) ?? '[]',
  );
  expect(stored).toHaveLength(presentedIdsLimit);
});

test('the presented id store drops its oldest ids first', async () => {
  const ids = Array.from({ length: presentedIdsLimit + 5 }, (_, index) =>
    payload(`rank-${index}`),
  );

  await runCheckers({
    checkers: [checker('ranks', async () => ids)],
    settings: ranksOnly,
  });

  const stored: string[] = JSON.parse(
    (await AsyncStorage.getItem(presentedIdsKey)) ?? '[]',
  );
  expect(stored.at(0)).toBe('rank-5');
});
