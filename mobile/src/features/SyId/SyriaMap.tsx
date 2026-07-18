import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';

import type { ProvinceCollection } from './model';
import { provinceBounds, selectProvince } from './model';

const boundaryMapStyle = {
  layers: [
    {
      id: 'background',
      paint: { 'background-color': '#24292F' },
      type: 'background',
    },
  ],
  sources: {},
  version: 8,
} as unknown as StyleSpecification;

interface SyriaMapProps {
  geoJsonData: ProvinceCollection;
  selectedGovId?: string;
}

export default function SyriaMap({ geoJsonData, selectedGovId = 'full' }: SyriaMapProps) {
  const filteredData = selectProvince(geoJsonData, selectedGovId);
  const bounds = provinceBounds(filteredData);

  return (
    <View style={styles.root}>
      <Map
        attribution={false}
        compass
        logo={false}
        mapStyle={boundaryMapStyle}
        style={styles.map}
      >
        <Camera
          bounds={bounds}
          maxZoom={10}
          minZoom={4}
          padding={{ bottom: 24, left: 24, right: 24, top: 24 }}
        />
        <GeoJSONSource data={filteredData} id="syria-provinces">
          <Layer
            id="syria-province-fill"
            paint={{ 'fill-color': '#428177', 'fill-opacity': 0.68 }}
            type="fill"
          />
          <Layer
            id="syria-province-outline"
            paint={{ 'line-color': '#E6EDF3', 'line-width': 1.5 }}
            type="line"
          />
        </GeoJSONSource>
      </Map>
      {filteredData.features.length === 0 ? (
        <View style={styles.empty}>
          <AppText color="muted">تعذر العثور على حدود المحافظة.</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  map: {
    flex: 1,
  },
  root: {
    backgroundColor: '#24292F',
    flex: 1,
    overflow: 'hidden',
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/SyId/SyriaMap.tsx (154 lines)
  confidence: high
  todos:      0
  notes:      Native MapLibre filtering and bounds preserve full-country and governorate views offline.
*/
