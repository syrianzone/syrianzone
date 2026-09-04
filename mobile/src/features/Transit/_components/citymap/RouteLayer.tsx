import {
  GeoJSONSource,
  Layer,
  type PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { NativeSyntheticEvent } from 'react-native';

import { routeColors } from '../../_lib/mapColors';
import { useMapStore } from '../../_store/useMapStore';
import type { RouteCollection } from '../../_types';

// Palette colors repeat, so wrap the index the way the website does or every
// route past the eighth one falls back to the first color.
const colorExpression = [
  'match',
  ['%', ['get', 'colorIndex'], routeColors.length],
  ...routeColors.flatMap((color, index) => [index, color]),
  routeColors[0],
] as unknown as ExpressionSpecification;

// Lines are 3 to 7 points wide, so taps need the same slack the website buys
// with its 16 pixel invisible hit layer.
const routeHitbox = { bottom: 16, left: 16, right: 16, top: 16 };

export function RouteLayer({
  interactive = false,
  routes,
}: {
  interactive?: boolean;
  routes: RouteCollection;
}) {
  const selectRoute = useMapStore((state) => state.selectRoute);
  const selectedRouteId = useMapStore((state) => state.selectedRouteId);
  const press = (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
    // Without this the press bubbles to the map, which clears the selection.
    event.stopPropagation();
    const id = event.nativeEvent.features[0]?.properties?.id;
    if (typeof id === 'string') {
      selectRoute(id);
    }
  };
  return (
    <GeoJSONSource
      data={routes}
      hitbox={interactive ? routeHitbox : undefined}
      id="transit-routes-source"
      onPress={interactive ? press : undefined}
    >
      <Layer
        id="transit-routes-casing"
        paint={{
          'line-color': '#ffffff',
          'line-opacity': selectedRouteId ? 0.4 : 0.72,
          'line-width': selectedRouteId ? 7 : 5,
        }}
        type="line"
      />
      <Layer
        id="transit-routes"
        paint={{
          'line-color': colorExpression,
          'line-opacity': selectedRouteId ? 0.45 : 0.92,
          'line-width': selectedRouteId ? 5 : 3,
        }}
        type="line"
      />
      {selectedRouteId ? (
        <Layer
          filter={['==', ['get', 'id'], selectedRouteId]}
          id="transit-route-selected"
          paint={{
            'line-color': colorExpression,
            'line-opacity': 1,
            'line-width': 7,
          }}
          type="line"
        />
      ) : null}
    </GeoJSONSource>
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/citymap/RouteLayer.tsx (194 lines)
  confidence: high
  todos:      0
  notes:      Declarative native line layers preserve stable colors and route focus, and a source hitbox replaces the invisible hit layer.
*/
