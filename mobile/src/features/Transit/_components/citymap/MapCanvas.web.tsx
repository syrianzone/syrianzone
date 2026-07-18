import type { MapRef } from '@maplibre/maplibre-react-native';
import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';

import type { City, MapDataResponse } from '../../_types';

interface MapCanvasProps {
  city: City;
  data: MapDataResponse;
  fitToData?: boolean;
  onMapPress?: (coordinate: [number, number]) => void;
  showUserLocation?: boolean;
}

export const MapCanvas = forwardRef<MapRef, MapCanvasProps>(
  function MapCanvas({ city, data }, _ref) {
    return (
      <View style={styles.fallback}>
        <AppText color="muted">
          خريطة النقل التفاعلية متاحة في تطبيق أندرويد وiOS.
        </AppText>
        <AppText color="muted" variant="caption">
          {city.nameAr}: {data.routes.features.length.toLocaleString('ar-SY')}{' '}
          خط و{data.stops.features.length.toLocaleString('ar-SY')} محطة.
        </AppText>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 360,
    padding: 24,
  },
});
