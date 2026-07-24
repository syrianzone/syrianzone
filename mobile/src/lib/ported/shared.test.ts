import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';

import {
  getCanonicalCityName,
  sortCitiesByOrder,
  standardizeCityNames,
} from './city-name-standardizer';
import { geoJsonToSVG, getGovernorateNameAr } from './geo-utils';

describe('ported shared utilities', () => {
  test('normalizes, aggregates, and orders governorates without mutating input', () => {
    expect(getCanonicalCityName('Ḩamāh')).toBe('حماة');
    expect(standardizeCityNames({ Hama: 3, 'حماة': 2, unknown: 0 })).toEqual({
      'حماة': 5,
      unknown: 0,
    });
    const cities: [string, number][] = [['طرطوس', 1], ['دمشق', 2]];
    expect(sortCitiesByOrder(cities)).toEqual([['دمشق', 2], ['طرطوس', 1]]);
    expect(cities).toEqual([['طرطوس', 1], ['دمشق', 2]]);
  });

  test('projects polygon and multipolygon boundaries into portable SVG', () => {
    const polygon: Feature<Polygon> = {
      geometry: {
        coordinates: [[[36, 33], [37, 33], [37, 34], [36, 33]]],
        type: 'Polygon',
      },
      properties: {},
      type: 'Feature',
    };
    const collection: FeatureCollection<MultiPolygon | Polygon> = {
      features: [polygon],
      type: 'FeatureCollection',
    };
    const svg = geoJsonToSVG(collection);
    expect(svg).toContain('<svg');
    expect(svg).toContain('<path');
    expect(svg).toContain('M0.050000,1.050000');
    expect(getGovernorateNameAr('Rural Damascus')).toBe('ريف دمشق');
    expect(getGovernorateNameAr('دمشق')).toBe('دمشق');
  });
});
