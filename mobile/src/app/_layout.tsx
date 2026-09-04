// Notifications first: TaskManager.defineTask must run at import time, before any screen mounts.
import {
  defineNotificationTask,
  registerChecker,
  useNotificationLifecycle,
} from '@/lib/notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ConditionalLayout } from '@/components/shell/ConditionalLayout';
import { useAppTheme } from '@/contexts/ThemeContext';
import { tierlistRankChecker } from '@/features/TierList/rankNotifications';
import { warningsChecker } from '@/features/Warnings/notifications';
import { configureMapLibreLogging } from '@/lib/maplibre/logging';
import { AppProviders } from '@/providers/AppProviders';

configureMapLibreLogging();
defineNotificationTask();
registerChecker(tierlistRankChecker);
registerChecker(warningsChecker);

function AppNavigator() {
  const { theme } = useAppTheme();
  useNotificationLifecycle();

  return (
    <ConditionalLayout>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: theme.palette.background },
          headerShown: false,
        }}
      />
    </ConditionalLayout>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <AppNavigator />
    </AppProviders>
  );
}
