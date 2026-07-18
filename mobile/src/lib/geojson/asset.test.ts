import type { FeatureCollection, Polygon } from 'geojson';

import { parseGeoJsonAsset } from './asset';

type TestCollection = FeatureCollection<Polygon, { id: string }>;

function isTestCollection(value: unknown): value is TestCollection {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { features?: unknown; type?: unknown };
  return candidate.type === 'FeatureCollection' && Array.isArray(candidate.features);
}

describe('bundled GeoJSON assets', () => {
  it('returns a collection accepted by its feature validator', () => {
    const collection = parseGeoJsonAsset(
      JSON.stringify({ features: [], type: 'FeatureCollection' }),
      isTestCollection,
    );

    expect(collection).toEqual({ features: [], type: 'FeatureCollection' });
  });

  it.each(['not json', '{"type":"Point"}'])(
    'hides invalid bundled data details for %s',
    (contents) => {
      expect(() => parseGeoJsonAsset(contents, isTestCollection)).toThrow(
        'Bundled map data is unavailable',
      );
    },
  );
});
