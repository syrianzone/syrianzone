import {
  Camera,
  Map,
  type MapRef,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';

import darkMapStyle from '@/assets/styles/dark-matter.json';

import type { City, MapDataResponse } from '../../_types';
import { RouteLayer } from './RouteLayer';
import { StopsLayer } from './StopsLayer';
import { UserLocationLayer } from './UserLocationLayer';

interface MapCanvasProps {
  city: City;
  data: MapDataResponse;
  onMapPress?: (coordinate: [number, number]) => void;
  showUserLocation?: boolean;
}

export const MapCanvas = forwardRef<MapRef, MapCanvasProps>(
  function MapCanvas(
    { city, data, onMapPress, showUserLocation = false },
    ref,
  ) {
    return (
      <View style={styles.container}>
        <Map
          attribution
          compass
          logo={false}
          mapStyle={darkMapStyle as unknown as StyleSpecification}
          onPress={(event) => {
            const [longitude, latitude] = event.nativeEvent.lngLat;
            onMapPress?.([longitude, latitude]);
          }}
          ref={ref}
          style={styles.map}
        >
          <Camera
            center={city.center}
            maxZoom={18}
            minZoom={7}
            zoom={city.zoom}
          />
          <RouteLayer routes={data.routes} />
          <StopsLayer stops={data.stops} />
          <UserLocationLayer visible={showUserLocation} />
        </Map>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/citymap/MapCanvas.tsx (117 lines)
  confidence: high
  todos:      0
  notes:      MapLibre native camera and GeoJSON layers replace the web canvas.
*/
