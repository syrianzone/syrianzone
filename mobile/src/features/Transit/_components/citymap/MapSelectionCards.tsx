import { X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { routeColor } from '../../_lib/mapColors';
import { useMapStore } from '../../_store/useMapStore';
import type { MapDataResponse } from '../../_types';

// The cards the browser draws as a MapLibre popup and a floating route label.
export function MapSelectionCards({ data }: { data: MapDataResponse }) {
  const { theme } = useAppTheme();
  const resetMap = useMapStore((state) => state.resetMap);
  const hoveredStopId = useMapStore((state) => state.hoveredStopId);
  const selectedRouteId = useMapStore((state) => state.selectedRouteId);
  const route = data.routes.features.find(
    (feature) => feature.properties.id === selectedRouteId,
  )?.properties;
  const stop = data.stops.features.find(
    (feature) => feature.properties.id === hoveredStopId,
  )?.properties;
  if (!route && !stop) {
    return null;
  }
  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      {route ? (
        <View
          style={[styles.routeCard, { backgroundColor: routeColor(route.colorIndex) }]}
        >
          <AppText style={[styles.grow, styles.onColor]} variant="label">
            {route.nameAr}
          </AppText>
          <Pressable
            accessibilityLabel="إغلاق"
            accessibilityRole="button"
            onPress={resetMap}
          >
            <X color="#ffffff" size={18} />
          </Pressable>
        </View>
      ) : null}
      {stop ? (
        <AppCard style={styles.stopCard}>
          <View style={styles.stopHeader}>
            <AppText style={styles.grow} variant="label">
              {stop.nameAr}
            </AppText>
            <Pressable
              accessibilityLabel="إغلاق"
              accessibilityRole="button"
              onPress={resetMap}
            >
              <X color={theme.palette.mutedForeground} size={18} />
            </Pressable>
          </View>
          <View style={styles.badges}>
            {stop.routeIds.length === 0 ? (
              <AppText color="muted" variant="caption">
                لا توجد مسارات
              </AppText>
            ) : (
              stop.routeIds.map((routeId) => {
                const badge = data.routes.features.find(
                  (feature) => feature.properties.id === routeId,
                )?.properties;
                return (
                  <View
                    key={routeId}
                    style={[
                      styles.badge,
                      { backgroundColor: routeColor(badge?.colorIndex ?? 0) },
                    ]}
                  >
                    <AppText style={styles.onColor} variant="caption">
                      {badge?.nameAr ?? `مسار ${routeId}`}
                    </AppText>
                  </View>
                );
              })
            )}
          </View>
        </AppCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  grow: {
    flex: 1,
  },
  onColor: {
    color: '#ffffff',
  },
  overlay: {
    bottom: 12,
    gap: 8,
    left: 12,
    position: 'absolute',
    right: 12,
  },
  routeCard: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  stopCard: {
    gap: 8,
    padding: 12,
  },
  stopHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
});
