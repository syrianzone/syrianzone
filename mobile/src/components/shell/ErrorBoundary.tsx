import type { ErrorBoundaryProps } from 'expo-router';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { getThemeById, resolveTheme, SYSTEM_THEME } from '@/lib/ported/theme';

// expo-router renders this in place of the crashed route, and the root layout
// mounts it above AppProviders, so nothing here may touch ThemeContext,
// LocaleContext, the query client, or the loaded Cairo fonts: all of those are
// gone by the time a render crash reaches this component. Colors come straight
// from the theme registry with literal fallbacks, and the copy is bilingual
// because there is no locale preference to read.
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const isDark = useColorScheme() === 'dark';
  const {
    background = '#ffffff',
    border = '#e5e5e5',
    danger = '#a2414a',
    foreground = '#0a0a0a',
    mutedForeground = '#737373',
    primary = '#4f6a49',
    primaryForeground = '#fafafa',
    surface = '#ffffff',
  } = getThemeById(resolveTheme(SYSTEM_THEME, isDark))?.palette ?? {};

  return (
    <View style={[styles.screen, { backgroundColor: background }]}>
      <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
        <Text style={[styles.title, { color: foreground }]}>
          حدث خطأ غير متوقع
        </Text>
        <Text style={[styles.subtitle, { color: mutedForeground }]}>
          Something went wrong
        </Text>
        {/* Selectable so a tester can copy the message into a bug report. */}
        <Text selectable style={[styles.message, { color: danger }]}>
          {error.message || 'Unknown error'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void retry()}
          style={[styles.button, { backgroundColor: primary }]}
        >
          <Text style={[styles.buttonLabel, { color: primaryForeground }]}>
            إعادة المحاولة
          </Text>
          <Text style={[styles.buttonHint, { color: primaryForeground }]}>
            Try again
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 14,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonHint: {
    fontSize: 13,
    opacity: 0.85,
  },
  buttonLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    maxWidth: 480,
    padding: 20,
    width: '100%',
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
  },
  screen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  subtitle: {
    fontSize: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'right',
  },
});
