import {
  Camera,
  GeoJSONSource,
  type GeoJSONSourceRef,
  Layer,
  Map,
  type CameraRef,
  type PressEventWithFeatures,
  type StyleSpecification,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { LocateFixed } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
} from 'react-native';

import darkMapStyle from '@/assets/styles/dark-matter.json';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import type { LatLng, PlaceFeatureCollection } from '../_lib/types';

const defaultCenter: [number, number] = [38, 35];

function pointCoordinates(feature: GeoJSON.Feature): [number, number] | null {
  if (feature.geometry.type !== 'Point') {
    return null;
  }
  const [longitude, latitude] = feature.geometry.coordinates;
  return typeof longitude === 'number' && typeof latitude === 'number'
    ? [longitude, latitude]
    : null;
}

export function PlacesMap({
  data,
  onAdd,
  onSelect,
  selectedId,
}: {
  data: PlaceFeatureCollection;
  onAdd: (point: LatLng) => void;
  onSelect: (id: number) => void;
  selectedId: number | null;
}) {
  const { theme } = useAppTheme();
  const cameraRef = useRef<CameraRef>(null);
  const sourceRef = useRef<GeoJSONSourceRef>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showUserLocation, setShowUserLocation] = useState(false);

  useEffect(() => {
    if (selectedId === null) {
      return;
    }
    const selected = data.features.find(
      (feature) => feature.properties.id === selectedId,
    );
    if (selected) {
      cameraRef.current?.easeTo({
        center: selected.geometry.coordinates,
        duration: 500,
        zoom: 12,
      });
    }
  }, [data.features, selectedId]);

  const select = async (
    event: NativeSyntheticEvent<PressEventWithFeatures>,
  ) => {
    const feature = event.nativeEvent.features[0];
    if (!feature) {
      return;
    }

    const clusterId = feature.properties?.cluster_id;
    const coordinates = pointCoordinates(feature);
    if (typeof clusterId === 'number' && coordinates) {
      const zoom = await sourceRef.current?.getClusterExpansionZoom(clusterId);
      cameraRef.current?.easeTo({
        center: coordinates,
        duration: 450,
        zoom: zoom ?? 10,
      });
      return;
    }

    const rawId = feature.properties?.id;
    const id = typeof rawId === 'number' ? rawId : Number(rawId);
    if (Number.isInteger(id) && id > 0) {
      onSelect(id);
    }
  };

  const locate = async () => {
    setLocationError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationError('يلزم السماح بالموقع للانتقال إلى مكانك.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setShowUserLocation(true);
      cameraRef.current?.flyTo({
        center: [position.coords.longitude, position.coords.latitude],
        duration: 800,
        zoom: 14,
      });
    } catch {
      setLocationError('تعذر تحديد موقعك الآن.');
    }
  };

  return (
    <View style={styles.root}>
      <Map
        attribution
        compass
        logo={false}
        mapStyle={darkMapStyle as unknown as StyleSpecification}
        onLongPress={(event) => {
          const [lng, lat] = event.nativeEvent.lngLat;
          onAdd({ lat, lng });
        }}
        style={styles.map}
      >
        <Camera center={defaultCenter} ref={cameraRef} zoom={6.2} />
        {showUserLocation ? <UserLocation accuracy heading /> : null}
        <GeoJSONSource
          cluster
          clusterMaxZoom={14}
          clusterRadius={50}
          data={data}
          id="places"
          onPress={(event) => void select(event)}
          ref={sourceRef}
        >
          <Layer
            filter={['has', 'point_count']}
            id="place-clusters"
            paint={{
              'circle-color': [
                'step',
                ['get', 'point_count'],
                '#657149',
                10,
                '#53603c',
                30,
                '#414c30',
              ],
              'circle-radius': [
                'step',
                ['get', 'point_count'],
                16,
                10,
                21,
                30,
                26,
              ],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
            }}
            type="circle"
          />
          <Layer
            filter={['has', 'point_count']}
            id="place-cluster-count"
            layout={{
              'text-field': ['get', 'point_count_abbreviated'],
              'text-size': 13,
            }}
            paint={{ 'text-color': '#ffffff' }}
            type="symbol"
          />
          <Layer
            filter={['!', ['has', 'point_count']]}
            id="place-points"
            paint={{
              'circle-color': [
                'case',
                ['==', ['get', 'id'], selectedId ?? -1],
                '#ef4444',
                '#7d8a5c',
              ],
              'circle-radius': [
                'case',
                ['==', ['get', 'id'], selectedId ?? -1],
                10,
                7,
              ],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
            }}
            type="circle"
          />
        </GeoJSONSource>
      </Map>
      <Pressable
        accessibilityLabel="الانتقال إلى موقعي"
        accessibilityRole="button"
        onPress={() => void locate()}
        style={[
          styles.locate,
          {
            backgroundColor: theme.palette.surface,
            borderColor: theme.palette.border,
          },
        ]}
      >
        <LocateFixed color={theme.palette.foreground} size={21} />
      </Pressable>
      {locationError ? (
        <View style={[styles.error, { backgroundColor: theme.palette.surface }]}>
          <AppText color="danger" variant="caption">
            {locationError}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    borderRadius: 8,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
    right: 60,
    top: 12,
  },
  locate: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    top: 12,
    width: 42,
  },
  map: {
    flex: 1,
  },
  root: {
    height: 420,
    overflow: 'hidden',
    position: 'relative',
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/PlacesMap.tsx (149 lines)
  confidence: high
  todos:      0
  notes:      Dark basemap, clusters, cluster expansion, location, selection, camera focus, and long-press contribution are native.
*/
