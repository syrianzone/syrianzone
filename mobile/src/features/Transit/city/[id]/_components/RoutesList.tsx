import { router } from 'expo-router';
import { Bus, Map, MapPin } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { routeColor } from '../../../_lib/mapColors';
import type { RouteProperties } from '../../../_types';

export function RoutesList({
  cityId,
  routes,
}: {
  cityId: string;
  routes: readonly RouteProperties[];
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.root}>
      {routes.map((route) => (
        <AppCard key={route.id} style={styles.route}>
          <Pressable
            accessibilityLabel={`تفاصيل ${route.nameAr}`}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/transit/city/[id]/route/[routeId]',
                params: { id: cityId, routeId: route.id },
              })
            }
            style={styles.details}
          >
            <View
              style={[
                styles.bus,
                { backgroundColor: routeColor(route.colorIndex) },
              ]}
            >
              <Bus color="#ffffff" size={20} />
            </View>
            <View style={styles.copy}>
              <AppText variant="label">{route.nameAr}</AppText>
              <View style={styles.metadata}>
                {route.stopsCount !== undefined ? (
                  <View style={styles.metaItem}>
                    <MapPin color={theme.palette.mutedForeground} size={14} />
                    <AppText color="muted" variant="caption">
                      {route.stopsCount.toLocaleString('ar-SY')} موقف
                    </AppText>
                  </View>
                ) : null}
                {route.priceNew && route.priceNew > 0 ? (
                  <AppText color="primary" variant="caption">
                    {route.priceNew.toLocaleString('ar-SY')} ل.س
                  </AppText>
                ) : null}
              </View>
            </View>
          </Pressable>
          <Pressable
            accessibilityLabel={`عرض ${route.nameAr} على الخريطة`}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/transit/city/[id]/map',
                params: { id: cityId, route: route.id },
              })
            }
            style={({ pressed }) => [
              styles.mapAction,
              {
                backgroundColor: theme.palette.surfaceRaised,
                opacity: pressed ? 0.65 : 1,
              },
            ]}
          >
            <Map color={theme.palette.primary} size={21} />
          </Pressable>
        </AppCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bus: {
    alignItems: 'center',
    borderRadius: 24,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  details: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 2,
  },
  mapAction: {
    alignItems: 'center',
    borderRadius: 24,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  metadata: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  root: {
    gap: 10,
  },
  route: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/city/[id]/_components/RoutesList.tsx (113 lines)
  confidence: high
  todos:      0
  notes:      Native cards preserve route colors, stops, fares, dedicated map entry, and detail navigation.
*/
