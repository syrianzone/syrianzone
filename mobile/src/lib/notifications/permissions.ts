// Permission and channel setup live apart from the checkers so the Settings screen can ask for
// permission the moment a switch turns on, before any check has ever run.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const notificationChannels = {
  alerts: {
    importance: Notifications.AndroidImportance.MAX,
    name: 'تنبيهات الطوارئ',
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  },
  updates: {
    importance: Notifications.AndroidImportance.DEFAULT,
    name: 'التحديثات',
  },
} as const satisfies Record<string, Notifications.NotificationChannelInput>;

export type NotificationChannelId = keyof typeof notificationChannels;

let channelsReady: Promise<void> | null = null;

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// Android needs the channels to exist before the first notification (and before the Android 13
// permission prompt can appear). The memoised promise makes repeated calls free.
export function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') {
    return Promise.resolve();
  }
  channelsReady ??= Promise.all(
    Object.entries(notificationChannels).map(([id, channel]) =>
      Notifications.setNotificationChannelAsync(id, channel),
    ),
  )
    .then(() => undefined)
    .catch(() => {
      channelsReady = null;
    });
  return channelsReady;
}
