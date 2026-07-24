import type { MapRef } from '@maplibre/maplibre-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { City, MapDataResponse } from '../../_types';
import { MapCanvas } from './MapCanvas';
import { MapContext } from './MapContext';

export function TransitMapView({
  city,
  data,
  editableVertices,
  fitToData,
  onMapPress,
  onVertexChange,
  onVertexPress,
  selectedVertexIndex,
  showUserLocation,
}: {
  city: City;
  data: MapDataResponse;
  editableVertices?: readonly [number, number][];
  fitToData?: boolean;
  onMapPress?: (coordinate: [number, number]) => void;
  onVertexChange?: (index: number, coordinate: [number, number]) => void;
  onVertexPress?: (index: number) => void;
  selectedVertexIndex?: number | null;
  showUserLocation?: boolean;
}) {
  const [map, setMap] = useState<MapRef | null>(null);
  const setMapRef = useCallback((instance: MapRef | null) => {
    setMap(instance);
  }, []);
  return (
    <MapContext.Provider value={map}>
      <View style={styles.root}>
        <MapCanvas
          city={city}
          data={data}
          editableVertices={editableVertices}
          fitToData={fitToData}
          onMapPress={onMapPress}
          onVertexChange={onVertexChange}
          onVertexPress={onVertexPress}
          ref={setMapRef}
          selectedVertexIndex={selectedVertexIndex}
          showUserLocation={showUserLocation}
        />
      </View>
    </MapContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/citymap/MapView.tsx (86 lines)
  confidence: high
  todos:      0
  notes:      The mounted native map instance is available through context while camera and vertex editing props pass through.
*/
