// Background execution is best effort: WorkManager (Android) and BGTaskScheduler (iOS) pick their
// own moment and skip low-battery or killed apps, so the throttled foreground check covers the
// common "user opened the app" case and the background task is only a bonus.
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import {
  readStringPreference,
  writeStringPreference,
} from '@/lib/storage/preferences';

import { runCheckers } from './checkers';
import { anyNotificationEnabled, type NotificationSettings } from './settings';

export const NOTIFICATIONS_TASK = 'sz-notification-checks';
export const lastForegroundCheckKey = 'sz-notifications-last-check';
const backgroundIntervalMinutes = 15;
const foregroundThrottleMs = 5 * 60_000;

interface ForegroundCheckOptions {
  now?: number;
  settings?: NotificationSettings;
}

export function defineNotificationTask(): void {
  if (TaskManager.isTaskDefined(NOTIFICATIONS_TASK)) {
    return;
  }
  TaskManager.defineTask(NOTIFICATIONS_TASK, async () => {
    await runCheckers();
    return BackgroundTask.BackgroundTaskResult.Success;
  });
}

export async function registerBackgroundChecks(
  settings: NotificationSettings,
): Promise<void> {
  try {
    const wanted = anyNotificationEnabled(settings);
    const registered = await TaskManager.isTaskRegisteredAsync(NOTIFICATIONS_TASK);
    if (wanted && !registered) {
      await BackgroundTask.registerTaskAsync(NOTIFICATIONS_TASK, {
        minimumInterval: backgroundIntervalMinutes,
      });
    } else if (!wanted && registered) {
      await BackgroundTask.unregisterTaskAsync(NOTIFICATIONS_TASK);
    }
  } catch {
    // Expo Go on Android and iOS simulators have no background tasks; foreground checks still run.
  }
}

export async function runForegroundCheck({
  now = Date.now(),
  settings,
}: ForegroundCheckOptions = {}): Promise<number> {
  // A missing or unparsable stamp counts as "never checked" (Number(null) would be 0, a finite value
  // that throttles everything), and a stamp in the future means the clock moved back, so check now.
  const stored = await readStringPreference(lastForegroundCheckKey);
  const last = stored === null ? Number.NaN : Number(stored);
  const elapsed = Number.isFinite(last) ? now - last : Infinity;
  if (elapsed >= 0 && elapsed < foregroundThrottleMs) {
    return 0;
  }
  await writeStringPreference(lastForegroundCheckKey, String(now)).catch(
    () => undefined,
  );
  return runCheckers({ settings });
}
