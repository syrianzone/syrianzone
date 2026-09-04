// Root-layout glue. Everything that must happen once per app process (handler, channels, tap
// routing, background registration) lives here so screens never touch expo-notifications directly.
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { registerBackgroundChecks, runForegroundCheck } from './background';
import { runCheckers } from './checkers';
import { ensureChannels } from './permissions';
import { useNotificationSettings } from './settings';

export {
  defineNotificationTask,
  NOTIFICATIONS_TASK,
  registerBackgroundChecks,
  runForegroundCheck,
} from './background';
export {
  registerChecker,
  registeredCheckers,
  runCheckers,
  type NotificationChecker,
  type NotificationPayload,
} from './checkers';
export { ensureChannels, ensureNotificationPermission } from './permissions';
export {
  defaultNotificationSettings,
  readNotificationSettings,
  useNotificationSettings,
  writeNotificationSettings,
  type NotificationSettings,
} from './settings';

const featureRoutes: Record<string, Href> = {
  tierlist: '/feature/tierlist',
  warnings: '/feature/warnings',
};
const handledResponses = new Set<string>();

export function featureRouteFor(
  data: Record<string, unknown> | undefined,
): Href | null {
  const feature = data?.feature;
  return typeof feature === 'string' ? (featureRoutes[feature] ?? null) : null;
}

// The cold-start response can also be replayed to the live listener, so responses are handled at
// most once per request identifier.
function openNotification(response: Notifications.NotificationResponse | null): void {
  const route = featureRouteFor(response?.notification.request.content.data);
  const identifier = response?.notification.request.identifier;
  if (!route || !identifier || handledResponses.has(identifier)) {
    return;
  }
  handledResponses.add(identifier);
  try {
    router.push(route);
  } catch {
    // Navigation is not mounted yet; the user still lands on the home screen.
  }
}

export function useNotificationLifecycle(): void {
  const { hydrated, settings } = useNotificationSettings();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    void ensureChannels();
    const subscription =
      Notifications.addNotificationResponseReceivedListener(openNotification);
    void Notifications.getLastNotificationResponseAsync()
      .then(openNotification)
      .catch(() => undefined);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    // A freshly enabled checker must seed its cursor right away, so settings changes bypass the
    // foreground throttle. Compared by value: a refetch hands back an equal object with a new
    // identity, and that must not count as a change.
    const key = `${settings.emergencyWarnings}:${settings.rankChanges}`;
    const changed = previous.current !== null && previous.current !== key;
    previous.current = key;
    void registerBackgroundChecks(settings);
    void (changed ? runCheckers({ settings }) : runForegroundCheck({ settings }));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void runForegroundCheck({ settings });
      }
    });
    return () => subscription.remove();
  }, [hydrated, settings]);
}
