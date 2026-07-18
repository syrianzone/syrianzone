import type { MapRef } from '@maplibre/maplibre-react-native';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { City, MapDataResponse } from '../../_types';
import { MapCanvas } from './MapCanvas';

export function TransitMapView({
  city,
  data,
  onMapPress,
  showUserLocation,
}: {
  city: City;
  data: MapDataResponse;
  onMapPress?: (coordinate: [number, number]) => void;
  showUserLocation?: boolean;
}) {
  const mapRef = useRef<MapRef>(null);
  return (
    <View style={styles.root}>
      <MapCanvas
        city={city}
        data={data}
        onMapPress={onMapPress}
        ref={mapRef}
        showUserLocation={showUserLocation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/citymap/MapView.tsx (28 lines)
  confidence: high
  todos:      0
  notes:      The native map ref replaces lazy browser map initialization.
*/
