import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';

import type { StopCollection } from '../../_types';

export function StopsLayer({ stops }: { stops: StopCollection }) {
  return (
    <GeoJSONSource data={stops} id="transit-stops-source">
      <Layer
        id="transit-stops"
        paint={{
          'circle-color': '#ffffff',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 15, 6],
          'circle-stroke-color': '#1f6f4a',
          'circle-stroke-width': 2,
        }}
        type="circle"
      />
    </GeoJSONSource>
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/citymap/StopsLayer.tsx (87 lines)
  confidence: high
  todos:      0
  notes:      One native circle layer replaces individual browser markers.
*/
