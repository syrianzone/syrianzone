import type { MapRef } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { LocateFixed } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { useMapStore } from '../../_store/useMapStore';
import type { City, MapDataResponse } from '../../_types';
import { MapCanvas } from './MapCanvas';
import { MapContext } from './MapContext';
import { MapSelectionCards } from './MapSelectionCards';

export function TransitMapView({
  city,
  data,
  editableVertices,
  fitToData,
  interactive = false,
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
  interactive?: boolean;
  onMapPress?: (coordinate: [number, number]) => void;
  onVertexChange?: (index: number, coordinate: [number, number]) => void;
  onVertexPress?: (index: number) => void;
  selectedVertexIndex?: number | null;
  showUserLocation?: boolean;
}) {
  const { theme } = useAppTheme();
  const [map, setMap] = useState<MapRef | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [located, setLocated] = useState(false);
  const focus = useMapStore((state) => state.focus);
  const focusMap = useMapStore((state) => state.focusMap);
  const resetMap = useMapStore((state) => state.resetMap);
  const setMapRef = useCallback((instance: MapRef | null) => {
    setMap(instance);
  }, []);

  // The browser map watches position from the first render, so draw the dot
  // right away whenever the user has already granted location.
  useEffect(() => {
    if (!interactive) {
      return;
    }
    Location.getForegroundPermissionsAsync()
      .then((permission) => setLocated(permission.granted))
      .catch(() => setLocated(false));
    // Leaving the map drops the selection so a later visit opens clean.
    return () => resetMap();
  }, [interactive, resetMap]);

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
      setLocated(true);
      focusMap([position.coords.longitude, position.coords.latitude], 16);
    } catch {
      setLocationError('تعذر تحديد موقعك الآن.');
    }
  };

  return (
    <MapContext.Provider value={map}>
      <View style={styles.root}>
        <MapCanvas
          city={city}
          data={data}
          editableVertices={editableVertices}
          fitToData={fitToData}
          focus={interactive ? focus : null}
          interactive={interactive}
          onMapPress={(coordinate) => {
            if (interactive) {
              resetMap();
            }
            onMapPress?.(coordinate);
          }}
          onVertexChange={onVertexChange}
          onVertexPress={onVertexPress}
          ref={setMapRef}
          selectedVertexIndex={selectedVertexIndex}
          showUserLocation={showUserLocation || located}
        />
        {interactive ? (
          <>
            <MapSelectionCards data={data} />
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
              <View
                style={[styles.error, { backgroundColor: theme.palette.surface }]}
              >
                <AppText color="danger" variant="caption">
                  {locationError}
                </AppText>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </MapContext.Provider>
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
  root: {
    flex: 1,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/citymap/MapView.tsx (86 lines)
  confidence: high
  todos:      0
  notes:      The mounted native map instance is available through context, and the interactive city map adds selection cards and a locate control.
*/
