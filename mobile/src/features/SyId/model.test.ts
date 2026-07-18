import type { ProvinceCollection } from './model';
import {
  filterGovernorates,
  governorateOptions,
  isProvinceCollection,
  provinceBounds,
  selectProvince,
  syrianIdentityPalettes,
} from './model';

const data: ProvinceCollection = {
  features: [
    {
      geometry: {
        coordinates: [[[36, 33], [37, 33], [37, 34], [36, 33]]],
        type: 'Polygon',
      },
      properties: { province_name: 'Damascus' },
      type: 'Feature',
    },
    {
      geometry: {
        coordinates: [[[37, 35], [38, 35], [38, 36], [37, 35]]],
        type: 'Polygon',
      },
      properties: { province_name: 'Aleppo' },
      type: 'Feature',
    },
  ],
  type: 'FeatureCollection',
};

describe('Syrian identity model', () => {
  test('keeps every official palette color and CMYK value', () => {
    expect(syrianIdentityPalettes).toHaveLength(4);
    expect(
      syrianIdentityPalettes.reduce(
        (count, palette) => count + palette.colors.length,
        0,
      ),
    ).toBe(12);
    expect(syrianIdentityPalettes[0]?.colors[0]).toEqual({
      cmyk: 'C76% M32% Y54% K10%',
      hex: '#428177',
      textColor: 'white',
    });
  });

  test('translates, searches, selects, and bounds governorates', () => {
    const options = governorateOptions(data);
    expect(options.map((option) => option.nameAr)).toEqual(['حلب', 'دمشق']);
    expect(filterGovernorates(options, 'دم')).toEqual([{ id: 'Damascus', nameAr: 'دمشق' }]);
    expect(selectProvince(data, 'Aleppo').features).toHaveLength(1);
    expect(provinceBounds(data)).toEqual([36, 33, 38, 36]);
  });

  test('rejects malformed bundled boundaries', () => {
    expect(isProvinceCollection(data)).toBe(true);
    expect(isProvinceCollection({ features: [], type: 'Feature' })).toBe(false);
    expect(isProvinceCollection({ features: [{ geometry: { type: 'Point' } }], type: 'FeatureCollection' })).toBe(false);
  });
});
