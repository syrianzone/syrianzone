import darkVectorStyle from '../../../../assets/styles/dark-matter-vector.json';
import lightVectorStyle from '../../../../assets/styles/light-vector.json';

import { buildTransitMapStyle } from './mapStyle';

test('keeps the Palestine country label override in the native vector map', () => {
  for (const style of [lightVectorStyle, darkVectorStyle]) {
    const countryLayers = style.layers.filter(
      (layer) => layer.id === 'place_country_1' || layer.id === 'place_country_2',
    );

    expect(countryLayers).toHaveLength(2);
    expect(JSON.stringify(countryLayers)).toContain('Palestine');
    expect(style.metadata['syrianzone:label-overrides']).toContain('Palestine');
  }
});

test('resolves the bundled glyph endpoint against the configured API origin', () => {
  const style = buildTransitMapStyle(
    lightVectorStyle,
    'https://api.example.test/base',
  );

  expect(style.glyphs).toBe(
    'https://api.example.test/base/fonts/map/{fontstack}/{range}.pbf',
  );
});
