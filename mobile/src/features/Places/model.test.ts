import type { PlaceFeatureCollection } from './_lib/types';
import { apiOrigin } from '@/lib/env';
import {
  filterPlaceFeatures,
  guideFilterFromParam,
  guideSearchParam,
  googleMapsUrl,
  isGeoSuggestionQuery,
  isPointInSyria,
  parseLatLng,
  placeShareUrl,
} from './model';

const fixture: PlaceFeatureCollection = {
  features: [
    { geometry: { coordinates: [36.29, 33.51], type: 'Point' }, properties: { category: 'historical', id: 1, name: 'خان أسعد باشا', thumb_url: null, user_id: 7 }, type: 'Feature' },
    { geometry: { coordinates: [35.78, 35.52], type: 'Point' }, properties: { category: 'natural', id: 2, name: 'غابات الفرلق', thumb_url: null, user_id: 9 }, type: 'Feature' },
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

  it('keeps every matching category pin for a coordinate query', () => {
    expect(filterPlaceFeatures(fixture, null, '33.51, 36.29')).toEqual(fixture);
  });

  it('filters pins to the selected local guide', () => {
    expect(filterPlaceFeatures(fixture, null, '', 9).features.map((feature) => feature.properties.id)).toEqual([2]);
  });

  it('returns an empty collection when source data is absent', () => {
    expect(filterPlaceFeatures(undefined, null, '')).toEqual({ features: [], type: 'FeatureCollection' });
  });
});

describe('guide search parameter', () => {
  it('opens a positive guide id with an unresolved display name', () => {
    expect(guideFilterFromParam('12')).toEqual({ id: 12, name: '' });
    expect(guideFilterFromParam(['9', '12'])).toEqual({ id: 9, name: '' });
  });

  it('rejects missing, zero, signed, decimal, and nonnumeric guide ids', () => {
    expect(guideFilterFromParam(undefined)).toBeNull();
    expect(guideFilterFromParam('0')).toBeNull();
    expect(guideFilterFromParam('-4')).toBeNull();
    expect(guideFilterFromParam('4.5')).toBeNull();
    expect(guideFilterFromParam('ليلى')).toBeNull();
  });

  it('serializes and clears the selected guide', () => {
    expect(guideSearchParam({ id: 12, name: 'ليلى' })).toBe('12');
    expect(guideSearchParam(null)).toBeUndefined();
  });
});

describe('smart coordinate search', () => {
  it('requests Google suggestions only for searchable text', () => {
    expect(isGeoSuggestionQuery(' ا ')).toBe(false);
    expect(isGeoSuggestionQuery('الحميدية')).toBe(true);
    expect(isGeoSuggestionQuery('34.73941, 36.67507')).toBe(false);
  });

  test.each([
    ['34.7394153, 36.6750744', { lat: 34.7394153, lng: 36.6750744 }],
    ['34,73192° N, 36,70764° E', { lat: 34.73192, lng: 36.70764 }],
    ['36,70764° E, 34,73192° N', { lat: 34.73192, lng: 36.70764 }],
    ['34.7 S, 36.6 W', { lat: -34.7, lng: -36.6 }],
    ['34,5°; 36,7°', { lat: 34.5, lng: 36.7 }],
    ['N 34,5; E 36,7', { lat: 34.5, lng: 36.7 }],
    ['N 34,5; 36,7', { lat: 34.5, lng: 36.7 }],
    ['34,5 N; 36,7', { lat: 34.5, lng: 36.7 }],
    ['34,5; E 36,7', { lat: 34.5, lng: 36.7 }],
    ['34,5; 36,7 E', { lat: 34.5, lng: 36.7 }],
    ['E 36; 34', { lat: 34, lng: 36 }],
    ['36; N 34', { lat: 34, lng: 36 }],
    ['S 34; 36', { lat: -34, lng: 36 }],
    ['34; W 36', { lat: 34, lng: -36 }],
    ['W 36, N 34', { lat: 34, lng: -36 }],
    ['-90, -180', { lat: -90, lng: -180 }],
    ['90, 180', { lat: 90, lng: 180 }],
    ['34 36', { lat: 34, lng: 36 }],
  ])('parses %s', (input, expected) => {
    expect(parseLatLng(input)).toEqual(expected);
  });

  test.each([
    '34,73192, 36,70764',
    '91, 30',
    '34, 190',
    '34.7 N, 36.6 N',
    '34.7 S, 36.6 S',
    '34.7 W, 36.6 W',
    'دمشق',
    '-34.7 S, 36.6 W',
    'N 34 N, E 36',
    '34,5 36.7',
    '34.5; 36,7',
    '-90.001, 36',
    '34, -180.001',
  ])('rejects %s', (input) => {
    expect(parseLatLng(input)).toBeNull();
  });

  it('accepts only contribution points inside the server bounds', () => {
    expect(isPointInSyria({ lat: 32, lng: 35.5 })).toBe(true);
    expect(isPointInSyria({ lat: 37.5, lng: 42.5 })).toBe(true);
    expect(isPointInSyria({ lat: 31.999, lng: 36 })).toBe(false);
    expect(isPointInSyria({ lat: 37.501, lng: 36 })).toBe(false);
    expect(isPointInSyria({ lat: 34, lng: 35.499 })).toBe(false);
    expect(isPointInSyria({ lat: 34, lng: 42.501 })).toBe(false);
  });

  it('builds stable share and map links without reversing coordinates', () => {
    expect(placeShareUrl(17)).toBe(`${apiOrigin}/mishwar?place=17`);
    expect(googleMapsUrl({ lat: 33.5138, lng: 36.2765 })).toBe(
      'https://www.google.com/maps/search/?api=1&query=33.5138%2C36.2765',
    );
  });

});
