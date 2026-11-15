import { describe, expect, test } from 'bun:test';
import sourceGeometry from './geometry.json';
import { buildLegend, DATA_TYPE_CONFIG, getColor, getTemperatureColor } from './rules';
import { decodeAtlas, decodeEnvironment, decodeGeometry, dynamicThresholds, latestRainfall, provinceValue, projectedPaths, toggleComparison } from './model';

describe('native Atlas source contracts', () => {
  test('preserves every original ring, island and the complete Quneitra outline', () => {
    const geometry = decodeGeometry(sourceGeometry);
    expect(geometry).toHaveLength(14);
    expect(geometry.reduce((sum, province) => sum + province.polygons.flat().reduce((count, ring) => count + ring.length, 0), 0)).toBe(8730);
    expect(geometry.find(province => province.pcode === 'SY10')?.polygons).toHaveLength(2);
    expect(geometry.find(province => province.pcode === 'SY03')?.polygons[0]).toHaveLength(2);
    const golan = geometry.find(province => province.pcode === 'SY14')!;
    expect(Math.min(...golan.polygons.flat().map(ring => Math.min(...ring.map(point => point[0]))))).toBeLessThan(35.7);
    const paths = projectedPaths(geometry);
    expect(paths).toHaveLength(14);
    expect(paths.every(path => !/NaN|Infinity/.test(path.d))).toBe(true);
    expect(paths.find(path => path.id === 'rural-damascus')?.d.match(/Z/g)).toHaveLength(2);
  });

  test('bundles the original geometry without simplifying or redrawing it', async () => {
    const source = Bun.file(new URL('../../../../public/assets/population/syr_admin1_opt.geojson', import.meta.url));
    expect(sourceGeometry).toEqual(await source.json());
    expect(new Bun.CryptoHasher('sha256').update(await source.arrayBuffer()).digest('hex')).toBe('329a28604a4c8bcba78bda4c1e95b5d389cd2c6f775d11d322405afd2dc7c66a');
  });

  test('rejects malformed positions and duplicate geometry ids', () => {
    const feature = { type: 'Feature', properties: { ADM1_PCODE: 'SY01', ADM1_AR: 'دمشق' }, geometry: { type: 'Polygon', coordinates: [[[36, 33], [36.1, 33], [36.1, 33.1], [36, 33]]] } };
    expect(() => decodeGeometry({ type: 'FeatureCollection', features: [{ ...feature, geometry: { type: 'Polygon', coordinates: [[[181, 33], [36.1, 33], [36.1, 33.1], [181, 33]]] } }] })).toThrow();
    expect(() => decodeGeometry({ type: 'FeatureCollection', features: [feature, feature] })).toThrow();
  });

  test('decodes sparse PHP collections and distinguishes recorded zero from unknown', () => {
    const atlas = decodeAtlas({ groups: { population: [{ source_id: 1, date: '2026-01-01', note: 'المصدر', source_url: 'https://example.org', cities: { Damascus: 0, 'Al-Hasakah': 20 } }], environmental: [{ source_id: 1, cities: { Damascus: 1 } }] }, rainfall_data: [] });
    expect(atlas.groups.idp).toEqual([]);
    expect(provinceValue(atlas.groups.population[0], 'دمشق')).toBe(0);
    expect(provinceValue(atlas.groups.population[0], 'SY08')).toBe(20);
    expect(provinceValue(atlas.groups.population[0], 'حمص')).toBeNull();
    expect(() => decodeAtlas({ groups: { population: [{ source_id: 1, cities: { Damascus: -1 } }] }, rainfall_data: {} })).toThrow();
    expect(() => decodeAtlas({ groups: {}, rainfall_data: { SY01: [{ year: 2026, rainfall: Infinity, rainfall_avg: 3 }] } })).toThrow();
  });

  test('uses the latest reported rainfall year, not the device year or array order', () => {
    expect(latestRainfall([{ year: 2020, rainfall: 20, average: 30 }, { year: 2019, rainfall: 80, average: 70 }])?.year).toBe(2020);
    expect(latestRainfall([])).toBeNull();
    expect(dynamicThresholds('population', { Damascus: 100, Homs: 0 })).toEqual([10, 40, 70]);
    expect(dynamicThresholds('rainfall', { Damascus: 100 })).toEqual([100, 300, 500]);
  });

  test('preserves the source two-province comparison replacement rule', () => {
    expect(toggleComparison([], 'damascus')).toEqual(['damascus']);
    expect(toggleComparison(['damascus', 'homs'], 'aleppo')).toEqual(['homs', 'aleppo']);
    expect(toggleComparison(['damascus', 'homs'], 'damascus')).toEqual(['homs']);
  });

  test('keeps source color boundaries and legends together, including zero degrees', () => {
    for (const type of ['population', 'idp', 'idp_returnees', 'rainfall'] as const) {
      const config = DATA_TYPE_CONFIG[type];
      if (config.kind !== 'value') throw new Error('Expected a value scale');
      const legend = buildLegend(type, config.thresholds);
      expect(getColor(config.thresholds[1], type, config.thresholds)).toBe(legend[1]!.color);
      expect(getColor(config.thresholds[1] + 1, type, config.thresholds)).toBe(legend[2]!.color);
      expect(getColor(config.thresholds[2] + 1, type, config.thresholds)).toBe(legend[3]!.color);
    }
    expect(getTemperatureColor(0)).toBe('#3b82f6');
    expect(getTemperatureColor(10)).toBe('#22c55e');
    expect(getTemperatureColor(20)).toBe('#22c55e');
    expect(getTemperatureColor(30)).toBe('#eab308');
  });

  test('decodes incomplete environmental snapshots without fabricating weather', () => {
    const report = decodeEnvironment({ metadata: { report_date: '2026-11-14T00:00:00+00:00', data_sources: ['Open-Meteo'], cities_analyzed: 1 }, cities: { Damascus: { coordinates: { latitude: 33, longitude: 36 }, population: 0, current_conditions: { temperature_celsius: 0, precipitation_mm: 0 }, daily_forecast_summary: [], climate_trends: [], air_quality: { estimated_aqi: 70, estimated: true, category: 'Moderate', health_recommendation: 'Example' }, drought_risk: [], historical_summary: [] } }, country_level: { climate_context: { classification: 'Arid', main_climate_challenges: [], key_water_basins: [] } }, summary: { key_findings: [], recommendations: [], total_cities_analyzed: 1 } });
    expect(report.cities.damascus?.current.temperature_celsius).toBe(0);
    expect(report.cities.damascus?.current.humidity_percent).toBeNull();
    expect(report.cities.damascus?.climate).toEqual({});
    expect(report.cities.damascus?.air?.estimated).toBe(true);
    expect(() => decodeEnvironment({ metadata: {}, cities: { Damascus: { coordinates: { latitude: 91, longitude: 36 } } } })).toThrow();
  });
});
