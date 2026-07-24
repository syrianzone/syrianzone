import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ConditionalLayout } from '@/components/shell/ConditionalLayout';
import { useAppTheme } from '@/contexts/ThemeContext';
import { configureMapLibreLogging } from '@/lib/maplibre/logging';
import { AppProviders } from '@/providers/AppProviders';

configureMapLibreLogging();

function AppNavigator() {
  const { theme } = useAppTheme();

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
