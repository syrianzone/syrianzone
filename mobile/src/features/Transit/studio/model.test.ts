import {
  appendCoordinate,
  buildTransitDraftGeoJson,
  hasPublishedRouteConflict,
  moveCoordinate,
  nearestSegmentInsertIndex,
  selfIntersections,
  undoCoordinate,
} from './model';

describe('transit studio geometry', () => {
  test('supports append, undo, and stable point reordering', () => {
    const points = appendCoordinate([[1, 1]], [2, 2]);
    expect(points).toEqual([[1, 1], [2, 2]]);
    expect(moveCoordinate(points, 1, 0)).toEqual([[2, 2], [1, 1]]);
    expect(undoCoordinate(points)).toEqual([[1, 1]]);
    expect(undoCoordinate([[1, 1]])).toBeNull();
  });

  test('inserts a tapped vertex after the nearest route segment', () => {
    expect(
      nearestSegmentInsertIndex(
        [[36.1, 33.1], [36.2, 33.2], [37, 34]],
        [36.15, 33.15],
      ),
    ).toBe(1);
    expect(nearestSegmentInsertIndex([], [36.15, 33.15])).toBe(0);
    expect(nearestSegmentInsertIndex([[36.1, 33.1]], [36.15, 33.15])).toBe(1);
  });

  test('flags crossing non-adjacent segments', () => {
    expect(selfIntersections([[0, 0], [1, 1], [0, 1], [1, 0]])).toEqual([[0, 2]]);
    expect(selfIntersections([[0, 0], [1, 0], [2, 0]])).toEqual([]);
    expect(selfIntersections([[0, 0], [1, 0], [1, 1], [0, 0]])).toEqual([]);
  });

  test('builds a line followed by ordered stop point features', () => {
    expect(
      buildTransitDraftGeoJson(
        [
          [36.2, 33.4],
          [36.3, 33.5],
        ],
        [
          { coordinates: [36.21, 33.41], nameAr: '  البرامكة  ' },
          { coordinates: [36.29, 33.49], nameAr: 'الأمويين' },
        ],
      ),
    ).toEqual({
      features: [
        {
          geometry: {
            coordinates: [
              [36.2, 33.4],
              [36.3, 33.5],
            ],
            type: 'LineString',
          },
          properties: { type: 'route' },
          type: 'Feature',
        },
        {
          geometry: { coordinates: [36.21, 33.41], type: 'Point' },
          properties: { nameAr: 'البرامكة', type: 'stop' },
          type: 'Feature',
        },
        {
          geometry: { coordinates: [36.29, 33.49], type: 'Point' },
          properties: { nameAr: 'الأمويين', type: 'stop' },
          type: 'Feature',
        },
      ],
      type: 'FeatureCollection',
    });
  });

  test('warns when a draft substantially overlaps a published route', () => {
    const published = [
      {
        geometry: {
          coordinates: [
            [36.1, 33.1],
            [36.9, 33.9],
          ],
        },
      },
    ];

    expect(
      hasPublishedRouteConflict(
        [
          [36.2, 33.2],
          [36.8, 33.8],
        ],
        published,
      ),
    ).toBe(true);
    expect(
      hasPublishedRouteConflict(
        [
          [40.0, 35.0],
          [40.5, 35.5],
        ],
        published,
      ),
    ).toBe(false);
  });
});
