import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import {
  defineNotificationTask,
  NOTIFICATIONS_TASK,
  registerBackgroundChecks,
  runForegroundCheck,
} from './background';
import { registerChecker, type NotificationChecker } from './checkers';
import type { NotificationSettings } from './settings';

const defineTask = jest.mocked(TaskManager.defineTask);
const isTaskDefined = jest.mocked(TaskManager.isTaskDefined);
const isTaskRegisteredAsync = jest.mocked(TaskManager.isTaskRegisteredAsync);
const registerTaskAsync = jest.mocked(BackgroundTask.registerTaskAsync);
const unregisterTaskAsync = jest.mocked(BackgroundTask.unregisterTaskAsync);

const allOff: NotificationSettings = {
  emergencyWarnings: false,
  rankChanges: false,
};
const ranksOn: NotificationSettings = {
  emergencyWarnings: false,
  rankChanges: true,
};

const run = jest.fn<ReturnType<NotificationChecker['run']>, []>(async () => []);
// The foreground path runs the module registry, so the suite owns one checker in it.
const checker: NotificationChecker = {
  channelId: 'updates',
  id: 'background-test-checker',
  run,
  settingKey: 'rankChanges',
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  isTaskRegisteredAsync.mockResolvedValue(false);
  registerChecker(checker);
});

test('the task is defined under the name the scheduler registers', () => {
  defineNotificationTask();

  expect(defineTask).toHaveBeenCalledWith(
    NOTIFICATIONS_TASK,
    expect.any(Function),
  );
});

test('a task already defined by an earlier import is left alone', () => {
  isTaskDefined.mockReturnValueOnce(true);

  defineNotificationTask();

  expect(defineTask).not.toHaveBeenCalled();
});

test('the task reports success back to the scheduler', async () => {
  defineNotificationTask();
  const call = defineTask.mock.calls[0];
  if (!call) {
    throw new Error('the task was never defined');
  }

  await expect(
    call[1]({
      data: null,
      error: null,
      executionInfo: { eventId: 'event-1', taskName: NOTIFICATIONS_TASK },
    }),
  ).resolves.toBe(BackgroundTask.BackgroundTaskResult.Success);
});

test('a switch that is on registers the background task', async () => {
  await registerBackgroundChecks(ranksOn);

  expect(registerTaskAsync).toHaveBeenCalledWith(NOTIFICATIONS_TASK, {
    minimumInterval: 15,
  });
});

test('an already registered task is not registered twice', async () => {
  isTaskRegisteredAsync.mockResolvedValue(true);

  await registerBackgroundChecks(ranksOn);

  expect(registerTaskAsync).not.toHaveBeenCalled();
});

test('every switch off unregisters the background task', async () => {
  isTaskRegisteredAsync.mockResolvedValue(true);

  await registerBackgroundChecks(allOff);

  expect(unregisterTaskAsync).toHaveBeenCalledWith(NOTIFICATIONS_TASK);
});

test('a platform without background tasks is not an error', async () => {
  registerTaskAsync.mockRejectedValueOnce(new Error('unsupported'));

  await expect(registerBackgroundChecks(ranksOn)).resolves.toBeUndefined();
});

test('the first foreground check runs even at a clock value below the throttle', async () => {
  await runForegroundCheck({ now: 1_000, settings: ranksOn });

  expect(run).toHaveBeenCalledTimes(1);
});

test('a second foreground check inside the throttle window is skipped', async () => {
  await runForegroundCheck({ now: 1_700_000_000_000, settings: ranksOn });

  await runForegroundCheck({ now: 1_700_000_240_000, settings: ranksOn });

  expect(run).toHaveBeenCalledTimes(1);
});

test('a foreground check after the throttle window runs again', async () => {
  await runForegroundCheck({ now: 1_700_000_000_000, settings: ranksOn });

  await runForegroundCheck({ now: 1_700_000_300_000, settings: ranksOn });

  expect(run).toHaveBeenCalledTimes(2);
});

test('a clock that moved backwards does not freeze the foreground check', async () => {
  await runForegroundCheck({ now: 1_700_000_000_000, settings: ranksOn });

  await runForegroundCheck({ now: 1_600_000_000_000, settings: ranksOn });

  expect(run).toHaveBeenCalledTimes(2);
});
