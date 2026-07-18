import { GeoJSONSource, Layer, Map, type PressEventWithFeatures } from '@maplibre/maplibre-react-native';
import { StyleSheet, View, type NativeSyntheticEvent } from 'react-native';

import type { PopulationCollection, PopulationFeature } from '../../types';
import MapUpdater from './MapUpdater';
import { selectedFeatureFromPress } from './map-interactions';
import { populationMapStyle } from './map-styles';

export default function MapClient({ data, onSelect }: { data: PopulationCollection; onSelect: (feature: PopulationFeature) => void }) {
  const handlePress = (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const feature = selectedFeatureFromPress(event.nativeEvent.features ?? []);
    if (feature) {
      onSelect(feature);
    }
  };
  return (
    <View style={styles.root}>
      <Map attribution={false} logo={false} mapStyle={populationMapStyle} style={styles.map}>
        <MapUpdater />
        <GeoJSONSource data={data} id="population-provinces" onPress={handlePress}>
          <Layer id="population-fill" paint={{ 'fill-color': ['coalesce', ['get', 'atlasColor'], '#3b82f6'], 'fill-opacity': 0.72 }} type="fill" />
          <Layer id="population-outline" paint={{ 'line-color': '#f8fafc', 'line-width': 1 }} type="line" />
        </GeoJSONSource>
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({ map: { flex: 1 }, root: { height: 420, overflow: 'hidden' } });

/*
PORT STATUS
  source:     resources/js/Pages/Population/components/map/MapClient.tsx (300 lines)
  confidence: high
  todos:      0
  notes:      Native MapLibre renders bundled province geometry and exposes province presses.
*/
