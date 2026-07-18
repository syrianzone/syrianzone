import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';

import { routeColors } from '../../_lib/mapColors';
import { useMapStore } from '../../_store/useMapStore';
import type { RouteCollection } from '../../_types';

const colorExpression = [
  'match',
  ['get', 'colorIndex'],
  ...routeColors.flatMap((color, index) => [index, color]),
  routeColors[0],
] as unknown as ExpressionSpecification;

export function RouteLayer({ routes }: { routes: RouteCollection }) {
  const selectedRouteId = useMapStore((state) => state.selectedRouteId);
  return (
    <GeoJSONSource data={routes} id="transit-routes-source">
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
  notes:      Declarative native line layers preserve stable colors and route focus.
*/
