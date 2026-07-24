import type {
  CircleLayerSpecification,
  SymbolLayerSpecification,
} from '@maplibre/maplibre-react-native';

export const PLACE_CLUSTER_RADIUS = 25;
export const PLACE_CLUSTER_MAX_ZOOM = 10;

export const PLACE_CLUSTER_PAINT: NonNullable<CircleLayerSpecification['paint']> = {
  'circle-color': 'hsl(105, 12%, 38%)',
  'circle-opacity': 0.85,
  'circle-radius': ['step', ['get', 'point_count'], 10, 10, 13, 30, 16],
  'circle-stroke-color': '#ffffff',
  'circle-stroke-opacity': 0.8,
  'circle-stroke-width': 1.5,
};

export const PLACE_CLUSTER_COUNT_LAYOUT: NonNullable<SymbolLayerSpecification['layout']> = {
  'text-field': ['get', 'point_count_abbreviated'],
  'text-font': ['IBM Plex Sans Arabic Bold'],
  'text-size': 11,
};

export function placePointPaint(
  selectedId: number | null,
): NonNullable<CircleLayerSpecification['paint']> {
  return {
    'circle-color': '#7d8a5c',
    'circle-radius': selectedId === null
      ? 6
      : ['case', ['==', ['get', 'id'], selectedId], 9, 6],
    'circle-stroke-color': '#ffffff',
    'circle-stroke-opacity': 0.9,
    'circle-stroke-width': 1.5,
  };
}

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/PlacesMap.tsx (235 lines)
  confidence: high
  todos:      0
  notes:      This native extraction preserves the final cluster radius, zoom, ink, sizing, opacity, and individual pin styling.
*/
