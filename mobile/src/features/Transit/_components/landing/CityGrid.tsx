import { router } from 'expo-router';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { useAppTheme } from '@/contexts/ThemeContext';

import type { City } from '../../_types';
import { CityCard } from './CityCard';

export function CityGrid({ cities }: { cities: readonly City[] }) {
  const { theme } = useAppTheme();
  const active = cities.filter((city) => city.status === 'active');
  const sorted = [...active].sort((left, right) => {
    const leftReady = left.routeCount > 0;
    const rightReady = right.routeCount > 0;
    if (leftReady !== rightReady) {
      return leftReady ? -1 : 1;
    }
    return right.routeCount - left.routeCount;
  });
  const readyCount = active.filter((city) => city.routeCount > 0).length;

  if (active.length === 0) {
    return <QueryState type="empty" />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <AppText variant="heading">المدن المتاحة</AppText>
        <AppText color="muted" variant="caption">
          {readyCount} / {active.length}
        </AppText>
      </View>
      {sorted.map((city) => <CityCard city={city} key={city.id} />)}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/transit/studio')}
      >
        <AppCard style={styles.contribute}>
          <View
            style={[
              styles.contributeIcon,
              { backgroundColor: theme.palette.surfaceRaised },
            ]}
          >
            <Plus color={theme.palette.primary} size={20} />
          </View>
          <View style={styles.copy}>
            <AppText variant="label">ساهم بإضافة خط</AppText>
            <AppText color="muted" variant="caption">
              تعرف على مسار سيرفيس غير مسجل؟ ارسمه على الخريطة
            </AppText>
          </View>
          <ChevronLeft color={theme.palette.mutedForeground} size={20} />
        </AppCard>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  contribute: {
    alignItems: 'center',
    borderStyle: 'dashed',
    flexDirection: 'row',
    gap: 12,
  },
  contributeIcon: {
    alignItems: 'center',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  copy: {
    flex: 1,
  },
  heading: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  root: {
    gap: 12,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/landing/CityGrid.tsx (66 lines)
  confidence: high
  todos:      0
  notes:      One ordered city list preserves ready and disabled upcoming cards, progress, and studio entry.
*/
