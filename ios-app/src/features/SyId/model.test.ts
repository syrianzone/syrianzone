import { expect, test } from 'bun:test';
import { decodeProvinces, exportProvinceSvg, selectProvince } from './model';
const polygon = { type: 'Feature', properties: { province_name: 'Damascus' }, geometry: { type: 'Polygon', coordinates: [[[36, 33], [37, 33], [37, 34], [36, 33]]] } };
test('preserves real longitude/latitude and province selection in export', () => {
  const provinces = decodeProvinces({ type: 'FeatureCollection', features: [polygon] });
  expect(provinces[0]?.polygons[0]?.[0]).toEqual({ longitude: 36, latitude: 33 });
  expect(selectProvince(provinces, 'Damascus')).toHaveLength(1);
  const xml = exportProvinceSvg(provinces);
  expect(xml).toContain('<svg'); expect(xml).toContain('fill="#428177"'); expect(xml).toContain('M');
  expect(() => decodeProvinces({ type: 'FeatureCollection', features: [{ ...polygon, geometry: { type: 'Point', coordinates: [36, 33] } }] })).toThrow();
});
test('exports every MultiPolygon without changing source geometry', () => {
  const raw = { ...polygon, geometry: { type: 'MultiPolygon', coordinates: [polygon.geometry.coordinates, [[[38, 34], [39, 34], [39, 35], [38, 34]]]] } };
  const provinces = decodeProvinces({ type: 'FeatureCollection', features: [raw] });
  expect(provinces[0]?.polygons).toHaveLength(2);
  expect(JSON.parse(JSON.stringify(provinces[0]?.feature))).toEqual(raw);
  expect(() => selectProvince(provinces, 'missing')).toThrow();
});

test('native map drawing includes all interior rings with even-odd compatible paths', async () => {
  const { provinceDrawing } = await import('./model');
  const withHole = { ...polygon, geometry: { type: 'Polygon', coordinates: [...polygon.geometry.coordinates, [[36.2, 33.2], [36.4, 33.2], [36.4, 33.4], [36.2, 33.2]]] } };
  const drawing = provinceDrawing(decodeProvinces({ type: 'FeatureCollection', features: [withHole] }));
  expect(drawing.paths[0]?.d.match(/M/g)).toHaveLength(2);
  expect(drawing.viewBox).not.toContain('NaN');
});
