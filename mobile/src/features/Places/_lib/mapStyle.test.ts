import {
  PLACE_CLUSTER_COUNT_LAYOUT,
  PLACE_CLUSTER_MAX_ZOOM,
  PLACE_CLUSTER_PAINT,
  PLACE_CLUSTER_RADIUS,
  placePointPaint,
} from './mapStyle';

test('uses the final calmer cluster settings from Mishwar', () => {
  expect(PLACE_CLUSTER_RADIUS).toBe(25);
  expect(PLACE_CLUSTER_MAX_ZOOM).toBe(10);
  expect(PLACE_CLUSTER_PAINT).toEqual({
    'circle-color': 'hsl(105, 12%, 38%)',
    'circle-opacity': 0.85,
    'circle-radius': ['step', ['get', 'point_count'], 10, 10, 13, 30, 16],
    'circle-stroke-color': '#ffffff',
    'circle-stroke-opacity': 0.8,
    'circle-stroke-width': 1.5,
  });
  expect(PLACE_CLUSTER_COUNT_LAYOUT).toEqual({
    'text-field': ['get', 'point_count_abbreviated'],
    'text-font': ['IBM Plex Sans Arabic Bold'],
    'text-size': 11,
  });
});

test('keeps individual pins calm while making the selection larger', () => {
  expect(placePointPaint(null)['circle-radius']).toBe(6);
  expect(placePointPaint(17)).toEqual({
    'circle-color': '#7d8a5c',
    'circle-radius': ['case', ['==', ['get', 'id'], 17], 9, 6],
    'circle-stroke-color': '#ffffff',
    'circle-stroke-opacity': 0.9,
    'circle-stroke-width': 1.5,
  });
});
