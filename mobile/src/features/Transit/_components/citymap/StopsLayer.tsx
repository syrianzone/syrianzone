import {
  GeoJSONSource,
  Layer,
  type PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import type { NativeSyntheticEvent } from 'react-native';

import { routeColors } from '../../_lib/mapColors';
import { useMapStore } from '../../_store/useMapStore';
import type { StopCollection } from '../../_types';

// Stop dots are 6 points wide at most, so they need a generous touch target.
const stopHitbox = { bottom: 22, left: 22, right: 22, top: 22 };

export function StopsLayer({
  interactive = false,
  stops,
}: {
  interactive?: boolean;
  stops: StopCollection;
}) {
  const hoveredStopId = useMapStore((state) => state.hoveredStopId);
  const selectStop = useMapStore((state) => state.selectStop);
  const press = (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
    // Without this the press bubbles to the map, which clears the selection.
    event.stopPropagation();
    const id = event.nativeEvent.features[0]?.properties?.id;
    if (typeof id === 'string') {
      selectStop(id);
    }
  };
  return (
    <GeoJSONSource
      data={stops}
      hitbox={interactive ? stopHitbox : undefined}
      id="transit-stops-source"
      onPress={interactive ? press : undefined}
    >
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
      {hoveredStopId ? (
        <Layer
          filter={['==', ['get', 'id'], hoveredStopId]}
          id="transit-stop-selected"
          paint={{
            'circle-color': routeColors[0],
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 15, 10],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 3,
          }}
          type="circle"
        />
      ) : null}
    </GeoJSONSource>
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/citymap/StopsLayer.tsx (87 lines)
  confidence: high
  todos:      0
  notes:      One native circle layer replaces individual browser markers, and a press highlights the stop the popup used to name.
*/
