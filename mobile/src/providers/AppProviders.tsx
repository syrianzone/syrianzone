import {
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
} from '@expo-google-fonts/cairo';
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AccountBoundary } from '@/components/auth/AccountBoundary';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { HomeSettingsProvider } from '@/contexts/HomeSettingsContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import {
  configureQueryManagers,
  createQueryClient,
} from '@/lib/query/client';

void SplashScreen.preventAutoHideAsync();

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(createQueryClient);
  const [fontsLoaded, fontError] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });

  useEffect(() => configureQueryManagers(), []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <LocaleProvider>
            <AppThemeProvider>
              <AuthProvider queryClient={queryClient}>
                <HomeSettingsProvider>
                  <AccountBoundary>{children}</AccountBoundary>
                </HomeSettingsProvider>
              </AuthProvider>
            </AppThemeProvider>
          </LocaleProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/*
PORT STATUS
  source:     resources/js/Providers/QueryProvider.tsx (24 lines)
  confidence: high
  todos:      0
  notes:      AppProviders owns the application-wide offline-first QueryClient and provider lifecycle.
*/
