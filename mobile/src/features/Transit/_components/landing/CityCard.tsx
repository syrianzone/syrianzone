import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { usePreloadCity } from '../../_hooks/useMapData';
import type { City } from '../../_types';
import { GovernorateIcon } from './GovernorateIcon';

export function CityCard({ city }: { city: City }) {
  const { theme } = useAppTheme();
  const preload = usePreloadCity();
  const enabled = city.status === 'active' && city.routeCount > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={() =>
        router.push({ pathname: '/transit/city/[id]', params: { id: city.id } })
      }
      onPressIn={() => preload(city.id)}
      style={({ pressed }) => ({ opacity: enabled ? (pressed ? 0.65 : 1) : 0.5 })}
    >
      <AppCard style={styles.card}>
        <View style={[styles.icon, { backgroundColor: theme.palette.surfaceRaised }]}>
          <GovernorateIcon
            cityId={city.id}
            color={theme.palette.primary}
            size={30}
          />
        </View>
        <View style={styles.copy}>
          <AppText variant="heading">{city.nameAr}</AppText>
          <AppText color="muted" variant="caption">
            {city.routeCount > 0 ? `${city.routeCount} خط` : 'قريباً'}
          </AppText>
        </View>
        {enabled ? <ChevronLeft color={theme.palette.mutedForeground} size={20} /> : null}
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  copy: {
    flex: 1,
  },
  icon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/landing/CityCard.tsx (118 lines)
  confidence: high
  todos:      0
  notes:      Native presses preserve city readiness, province silhouettes, counts, navigation, and prefetch.
*/
