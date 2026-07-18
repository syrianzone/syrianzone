import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';

import type { LatLng, PlaceFeatureCollection } from '../_lib/types';

export function PlacesMap({
  data,
}: {
  addMode: boolean;
  data: PlaceFeatureCollection;
  focus: { key: number; lat: number; lng: number; zoom?: number } | null;
  highlight: LatLng | null;
  onMapPress: (point: LatLng) => void;
  onSelect: (id: number) => void;
  selectedId: number | null;
}) {
  return (
    <View style={styles.fallback}>
      <AppText color="muted">
        خريطة الأماكن التفاعلية متاحة في تطبيق أندرويد وiOS.
      </AppText>
      <AppText color="muted" variant="caption">
        تم تحميل {data.features.length.toLocaleString('ar-SY')} مكان.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    gap: 8,
    height: 360,
    justifyContent: 'center',
    padding: 24,
  },
});
