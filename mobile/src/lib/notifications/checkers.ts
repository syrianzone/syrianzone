// Extension surface for local notifications. Features register a checker that reports only what is
// new; this module owns the presentation policy (settings gate, dedupe, one failing checker never
// blocking the rest). Keeping the policy here means checkers stay pure and testable.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { z } from 'zod';

import {
  readJsonPreference,
  writeJsonPreference,
} from '@/lib/storage/preferences';

import type { NotificationChannelId } from './permissions';
import { readNotificationSettings, type NotificationSettings } from './settings';

export interface NotificationPayload {
  body: string;
  data?: Record<string, string>;
  id: string;
  title: string;
}

export interface NotificationChecker {
  channelId: NotificationChannelId;
  id: string;
  run(signal?: AbortSignal): Promise<NotificationPayload[]>;
  settingKey: keyof NotificationSettings;
}

interface RunCheckersOptions {
  // Defaults to the module registry; passing a list keeps the policy testable without global state.
  checkers?: readonly NotificationChecker[];
  settings?: NotificationSettings;
  signal?: AbortSignal;
}

export const presentedIdsKey = 'sz-notifications-presented';
export const presentedIdsLimit = 200;
const presentedIdsSchema = z.array(z.string());
const checkers: NotificationChecker[] = [];

export function registerChecker(checker: NotificationChecker): void {
  const index = checkers.findIndex(({ id }) => id === checker.id);
  if (index >= 0) {
    checkers[index] = checker;
  } else {
    checkers.push(checker);
  }
}

export function registeredCheckers(): readonly NotificationChecker[] {
  return checkers;
}

async function collect(
  checker: NotificationChecker,
  signal?: AbortSignal,
): Promise<NotificationPayload[]> {
  try {
    return await checker.run(signal);
  } catch {
    return [];
  }
}

// Android routes by channel so emergencies get MAX importance; iOS has no channels, so a null
// trigger (deliver now) is all it needs.
function present(
  checker: NotificationChecker,
  payload: NotificationPayload,
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { body: payload.body, data: payload.data, title: payload.title },
    trigger: Platform.OS === 'android' ? { channelId: checker.channelId } : null,
  });
}

export async function runCheckers({
  checkers: requested,
  settings,
  signal,
}: RunCheckersOptions = {}): Promise<number> {
  try {
    const enabled = settings ?? (await readNotificationSettings());
    const presented =
      (await readJsonPreference(presentedIdsKey, presentedIdsSchema)) ?? [];
    let count = 0;
    for (const checker of requested ?? checkers) {
      if (!enabled[checker.settingKey] || signal?.aborted) {
        continue;
      }
      for (const payload of await collect(checker, signal)) {
        if (presented.includes(payload.id)) {
          continue;
        }
        try {
          await present(checker, payload);
          presented.push(payload.id);
          count += 1;
        } catch {
          // A failed presentation is retried on the next run because its id was not recorded.
        }
      }
    }
    await writeJsonPreference(presentedIdsKey, presented.slice(-presentedIdsLimit));
    return count;
  } catch {
    return 0;
  }
}
