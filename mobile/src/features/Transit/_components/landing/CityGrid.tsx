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
  const ready = active
    .filter((city) => city.routeCount > 0)
    .sort((left, right) => right.routeCount - left.routeCount);
  const pending = active.filter((city) => city.routeCount === 0);

  if (active.length === 0) {
    return <QueryState type="empty" />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <AppText variant="heading">المدن المتاحة</AppText>
        <AppText color="muted" variant="caption">
          {ready.length} / {active.length}
        </AppText>
      </View>
      {ready.map((city) => <CityCard city={city} key={city.id} />)}
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
      {pending.length ? (
        <View style={styles.pending}>
          <AppText color="muted" variant="label">مدن قيد الإضافة</AppText>
          <View style={styles.pills}>
            {pending.map((city) => (
              <View
                key={city.id}
                style={[styles.pill, { borderColor: theme.palette.border }]}
              >
                <AppText color="muted" variant="caption">{city.nameAr}</AppText>
              </View>
            ))}
          </View>
        </View>
      ) : null}
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
  pending: {
    gap: 8,
    marginTop: 12,
  },
  pill: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  root: {
    gap: 12,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/landing/CityGrid.tsx (71 lines)
  confidence: high
  todos:      0
  notes:      Ready ordering, progress count, studio entry, and pending city chips are preserved natively.
*/
