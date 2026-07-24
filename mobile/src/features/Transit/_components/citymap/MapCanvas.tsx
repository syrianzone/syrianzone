import {
  Camera,
  Map,
  type MapRef,
  type StyleSpecification,
  ViewAnnotation,
} from '@maplibre/maplibre-react-native';
import { forwardRef, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import darkMapStyle from '../../../../../assets/styles/dark-matter-vector.json';
import lightMapStyle from '../../../../../assets/styles/light-vector.json';

import { useTransitTheme } from '../TransitThemeContext';
import { buildTransitMapStyle } from '../../_lib/mapStyle';
import type { City, MapDataResponse } from '../../_types';
import { routeCameraTarget } from '../../model';
import { RouteLayer } from './RouteLayer';
import { StopsLayer } from './StopsLayer';
import { UserLocationLayer } from './UserLocationLayer';

interface MapCanvasProps {
  city: City;
  data: MapDataResponse;
  editableVertices?: readonly [number, number][];
  fitToData?: boolean;
  onMapPress?: (coordinate: [number, number]) => void;
  onVertexChange?: (index: number, coordinate: [number, number]) => void;
  onVertexPress?: (index: number) => void;
  selectedVertexIndex?: number | null;
  showUserLocation?: boolean;
}

export const MapCanvas = forwardRef<MapRef, MapCanvasProps>(
  function MapCanvas(
    {
      city,
      data,
      editableVertices,
      fitToData = false,
      onMapPress,
      onVertexChange,
      onVertexPress,
      selectedVertexIndex = null,
      showUserLocation = false,
    },
    ref,
  ) {
    const { theme } = useTransitTheme();
    const routeTarget = useMemo(
      () => fitToData ? routeCameraTarget(data.routes) : null,
      [data.routes, fitToData],
    );
    const mapStyle = useMemo(
      () => buildTransitMapStyle(
        theme === 'jasmine' ? lightMapStyle : darkMapStyle,
      ) as unknown as StyleSpecification,
      [theme],
    );
    const cityBounds = city.bounds
      ? [
          city.bounds[0][0],
          city.bounds[0][1],
          city.bounds[1][0],
          city.bounds[1][1],
        ] as [number, number, number, number]
      : null;
    return (
      <View style={styles.container}>
        <Map
          attribution
          compass
          logo={false}
          mapStyle={mapStyle}
          onPress={(event) => {
            const [longitude, latitude] = event.nativeEvent.lngLat;
            onMapPress?.([longitude, latitude]);
          }}
          ref={ref}
          style={styles.map}
        >
          {routeTarget?.kind === 'bounds' ? (
            <Camera
              bounds={routeTarget.bounds}
              maxZoom={16}
              minZoom={7}
              padding={{ bottom: 60, left: 60, right: 60, top: 60 }}
            />
          ) : routeTarget?.kind === 'center' ? (
            <Camera
              center={routeTarget.center}
              maxZoom={18}
              minZoom={7}
              zoom={routeTarget.zoom}
            />
          ) : cityBounds ? (
            <Camera
              bounds={cityBounds}
              maxZoom={18}
              minZoom={7}
              padding={{ bottom: 48, left: 48, right: 48, top: 48 }}
            />
          ) : (
            <Camera
              center={city.center}
              maxZoom={18}
              minZoom={7}
              zoom={city.zoom}
            />
          )}
          <RouteLayer routes={data.routes} />
          <StopsLayer stops={data.stops} />
          <UserLocationLayer visible={showUserLocation} />
          {editableVertices?.map((coordinate, index) => {
            const selected = selectedVertexIndex === index;
            return (
              <ViewAnnotation
                draggable
                id={`transit-edit-vertex-${index}`}
                key={`transit-edit-vertex-${index}`}
                lngLat={coordinate}
                onDrag={(event) => {
                  const [longitude, latitude] = event.nativeEvent.lngLat;
                  onVertexChange?.(index, [longitude, latitude]);
                }}
                onPress={() => onVertexPress?.(index)}
                selected={selected}
              >
                <View
                  style={[
                    styles.vertex,
                    {
                      backgroundColor: selected
                        ? '#c44b4b'
                        : '#c8963a',
                      borderColor: '#ffffff',
                      height: selected ? 24 : 18,
                      width: selected ? 24 : 18,
                    },
                  ]}
                  testID={`transit-edit-vertex-dot-${index}`}
                />
              </ViewAnnotation>
            );
          })}
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
  vertex: {
    borderRadius: 12,
    borderWidth: 3,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/citymap/MapCanvas.tsx (119 lines)
  confidence: high
  todos:      0
  notes:      Theme-aware MapLibre styles, bounded route focus, and draggable route vertices preserve native editing.
*/
