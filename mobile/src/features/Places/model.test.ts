import type { PlaceFeatureCollection } from './_lib/types';
import { filterPlaceFeatures } from './model';

const fixture: PlaceFeatureCollection = {
  features: [
    { geometry: { coordinates: [36.29, 33.51], type: 'Point' }, properties: { category: 'historical', id: 1, name: 'خان أسعد باشا', thumb_url: null }, type: 'Feature' },
    { geometry: { coordinates: [35.78, 35.52], type: 'Point' }, properties: { category: 'natural', id: 2, name: 'غابات الفرلق', thumb_url: null }, type: 'Feature' },
  ],
  type: 'FeatureCollection',
};

describe('place map filtering', () => {
  it('keeps longitude before latitude while filtering category', () => {
    const result = filterPlaceFeatures(fixture, 'natural', '');
    expect(result.features).toHaveLength(1);
    expect(result.features[0]?.geometry.coordinates).toEqual([35.78, 35.52]);
  });

  it('trims the query and matches Arabic names', () => {
    expect(filterPlaceFeatures(fixture, null, '  خان  ').features.map((feature) => feature.properties.id)).toEqual([1]);
  });

  it('returns an empty collection when source data is absent', () => {
    expect(filterPlaceFeatures(undefined, null, '')).toEqual({ features: [], type: 'FeatureCollection' });
  });
});
