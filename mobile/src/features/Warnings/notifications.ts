/**
 * Emergency warnings as a notification source. The scheduler lives in
 * lib/notifications (owned elsewhere); this module only decides what is new.
 * "New" means published after the newest publish time already seen, kept in
 * preferences under sz-warnings-cursor. The first run only records the
 * cursor, so a fresh install never receives a backlog dump, and the cursor
 * is a publish time rather than an id because ids are jard's and could be
 * renumbered if the aggregator re-imports the feed.
 */
import type {
  NotificationChecker,
  NotificationPayload,
} from '@/lib/notifications/checkers';
import {
  readStringPreference,
  writeStringPreference,
} from '@/lib/storage/preferences';

import { fetchWarnings, type WarningsPayload } from './api';
import {
  newerThan,
  newestPublishedAt,
  sortNewestFirst,
  type WarningItem,
} from './model';


export const WARNINGS_CURSOR_KEY = 'sz-warnings-cursor';
export const MAX_WARNING_NOTIFICATIONS = 5;

export interface WarningsCheckerDependencies {
  fetch?: (signal?: AbortSignal) => Promise<WarningsPayload>;
  readCursor?: () => Promise<string | null>;
  writeCursor?: (value: string) => Promise<void>;
}

export function toNotificationPayload(item: WarningItem): NotificationPayload {
  return {
    body: item.title,
    data: { feature: 'warnings', url: item.link },
    id: `warning-${item.id}`,
    title: 'تنبيه طوارئ',
  };
}

export function createWarningsChecker(
  deps: WarningsCheckerDependencies = {},
): NotificationChecker {
  const fetchPayload = deps.fetch ?? fetchWarnings;
  const readCursor =
    deps.readCursor ?? (() => readStringPreference(WARNINGS_CURSOR_KEY));
  const writeCursor =
    deps.writeCursor ??
    ((value: string) => writeStringPreference(WARNINGS_CURSOR_KEY, value));

  return {
    channelId: 'alerts',
    id: 'emergency-warnings',
    settingKey: 'emergencyWarnings',
    async run(signal) {
      const { items } = await fetchPayload(signal);
      const newest = newestPublishedAt(items);
      if (newest === null) {
        return [];
      }

      const cursor = await readCursor();
      const cursorTime = cursor === null ? Number.NaN : Date.parse(cursor);
      if (Number.isNaN(cursorTime)) {
        await writeCursor(newest);
        return [];
      }

      const payloads = sortNewestFirst(newerThan(items, cursor))
        .slice(0, MAX_WARNING_NOTIFICATIONS)
        .map(toNotificationPayload);
      if (Date.parse(newest) > cursorTime) {
        await writeCursor(newest);
      }
      return payloads;
    },
  };
}

export const warningsChecker = createWarningsChecker();

/*
PORT STATUS
  source:     none (new native feature)
  confidence: high
  todos:      0
  notes:      Cursor-based at-most-once delivery, capped at five newest, silent on first run.
*/
