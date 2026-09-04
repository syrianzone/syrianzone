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

// expo-router looks for an `ErrorBoundary` export on every route file. Exporting
// it from the root layout catches render crashes in the layout and in every
// screen below it, which is what a release build otherwise shows as a blank
// screen or an Android "keeps stopping" dialog.
export { AppErrorBoundary as ErrorBoundary } from '@/components/shell/ErrorBoundary';

export default function RootLayout() {
  return (
    <AppProviders>
      <AppNavigator />
    </AppProviders>
  );
}
