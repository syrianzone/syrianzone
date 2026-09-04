/**
 * Home banner for the newest emergency warning. It shares the warnings query
 * with the screen so opening the feature costs no second request, and it
 * stays silent past 24 hours because a day-old flood notice on the start
 * page reads as noise rather than urgency. "now" is a prop so tests can pin
 * the clock; production measures freshness from the fetch time.
 */
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';

import { fetchWarnings, warningsQueryKey } from './api';
import { WARNINGS_STALE_TIME_MS } from './Index';
import { isFresh } from './model';

const bannerRed = '#dc2626';

interface LatestWarningBannerProps {
  now?: number;
}

export function openWarningsFeature(): void {
  router.push({ pathname: '/feature/[slug]', params: { slug: 'warnings' } });
}

export function LatestWarningBanner({ now }: LatestWarningBannerProps) {
  const { direction, locale } = useLocale();
  const { theme } = useAppTheme();
  const query = useQuery({
    queryFn: ({ signal }) => fetchWarnings(signal),
    queryKey: warningsQueryKey,
    staleTime: WARNINGS_STALE_TIME_MS,
  });
  const latest = query.data?.items[0];
  if (!latest || !isFresh(latest, now ?? query.dataUpdatedAt)) {
    return null;
  }
  const Chevron = direction === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={openWarningsFeature}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: `${bannerRed}1a`,
          borderColor: `${bannerRed}66`,
          flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
          opacity: pressed ? 0.8 : 1,
        },
      ]}
      testID="latest-warning-banner"
    >
      <TriangleAlert color={bannerRed} size={22} />
      <View style={styles.copy}>
        <AppText style={{ color: bannerRed }} variant="caption">
          {locale === 'ar' ? 'تنبيه طوارئ' : 'Emergency warning'}
        </AppText>
        <AppText numberOfLines={2} variant="label">
          {latest.title}
        </AppText>
      </View>
      <Chevron color={theme.palette.mutedForeground} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
});

/*
PORT STATUS
  source:     none (new native feature)
  confidence: high
  todos:      0
  notes:      Hidden past 24 hours; taps route to /feature/warnings. Placement on the home screen is owned elsewhere.
*/
