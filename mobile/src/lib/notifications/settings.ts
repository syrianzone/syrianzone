// Device-local notification preferences. They deliberately stay out of HomeSettingsContext so a
// toggle on one phone never enables background checks on another phone using the same account.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { z } from 'zod';

import {
  readJsonPreference,
  writeJsonPreference,
} from '@/lib/storage/preferences';

export const notificationSettingsKey = 'sz-notification-settings';
export const notificationSettingsQueryKey = ['notification-settings'] as const;

export const notificationSettingsSchema = z.object({
  emergencyWarnings: z.boolean().default(false),
  rankChanges: z.boolean().default(false),
});

export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

export const defaultNotificationSettings: NotificationSettings = {
  emergencyWarnings: false,
  rankChanges: false,
};

export interface NotificationSettingsState {
  hydrated: boolean;
  settings: NotificationSettings;
  update: (patch: Partial<NotificationSettings>) => Promise<NotificationSettings>;
}

export async function readNotificationSettings(): Promise<NotificationSettings> {
  const stored = await readJsonPreference(
    notificationSettingsKey,
    notificationSettingsSchema,
  );
  return stored ?? defaultNotificationSettings;
}

export async function writeNotificationSettings(
  patch: Partial<NotificationSettings>,
): Promise<NotificationSettings> {
  const next = notificationSettingsSchema.parse({
    ...(await readNotificationSettings()),
    ...patch,
  });
  await writeJsonPreference(notificationSettingsKey, next);
  return next;
}

export function anyNotificationEnabled(settings: NotificationSettings): boolean {
  return Object.values(settings).some(Boolean);
}

export function useNotificationSettings(): NotificationSettingsState {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryFn: readNotificationSettings,
    queryKey: notificationSettingsQueryKey,
    staleTime: Infinity,
  });
  const update = useCallback(
    async (patch: Partial<NotificationSettings>) => {
      const next = await writeNotificationSettings(patch);
      queryClient.setQueryData(notificationSettingsQueryKey, next);
      return next;
    },
    [queryClient],
  );
  return {
    hydrated: query.data !== undefined,
    settings: query.data ?? defaultNotificationSettings,
    update,
  };
}
