import { array, finiteNumber, record, text } from '../../platform/validation';
import type { Coordinate } from '../../domain';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Execute the original pure export algorithm without importing legacy web compiler settings.
const { featureToSVG } = require('../../../../resources/js/Pages/SyId/featureToSVG') as { featureToSVG(value: unknown): string };
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Reuse the source governorate vocabulary unchanged.
const { getGovernorateNameAr } = require('../../../../resources/js/Domain/geography/governorates') as { getGovernorateNameAr(value: string): string };
export interface Province { id: string; name: string; polygons: Coordinate[][]; holes: Coordinate[][]; feature: Record<string, unknown> }
function coordinate(value: unknown): Coordinate {
  const pair = array(value); if (pair.length < 2) throw new Error('إحداثيات خريطة غير صالحة.');
  const longitude = finiteNumber(pair[0]); const latitude = finiteNumber(pair[1]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('إحداثيات خريطة غير صالحة.');
  return { latitude, longitude };
}
export function decodeProvinces(value: unknown): Province[] {
  const collection = record(value); if (collection.type !== 'FeatureCollection') throw new Error('بيانات الخريطة غير صالحة.');
  return array(collection.features).map(item => {
    const feature = record(item); const geometry = record(feature.geometry); const properties = record(feature.properties);
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') throw new Error('شكل محافظة غير صالح.');
    const shapes = geometry.type === 'Polygon' ? [array(geometry.coordinates)] : array(geometry.coordinates).map(array);
    const polygons: Coordinate[][] = []; const holes: Coordinate[][] = [];
    for (const shape of shapes) { if (!shape.length) throw new Error('محافظة بلا حدود.'); shape.forEach((ring, index) => { const points = array(ring).map(coordinate); if (points.length < 4) throw new Error('حدود محافظة غير مكتملة.'); if (index === 0) polygons.push(points); else holes.push(points); }); }
    const id = text(properties.province_name);
    return { id, name: getGovernorateNameAr(id), polygons, holes, feature };
  });
}
export function selectProvince(provinces: Province[], id: string): Province[] {
  if (id === 'full') return provinces;
  const selected = provinces.filter(province => province.id === id);
  if (!selected.length) throw new Error('المحافظة غير موجودة.');
  return selected;
}
export function exportProvinceSvg(provinces: Province[]): string { return featureToSVG({ type: 'FeatureCollection', features: provinces.map(province => province.feature) }); }
export function exportGeoJson(provinces: Province[]): string { return JSON.stringify({ type: 'FeatureCollection', features: provinces.map(province => province.feature) }, null, 2); }
// PORT STATUS: source resources/js/Pages/SyId/featureToSVG.ts and SyriaMap.tsx; confidence high; todos 0.

export function provinceDrawing(provinces: Province[]): { viewBox: string; paths: { id: string; name: string; d: string }[] } {
  const project = (point: Coordinate): { x: number; y: number } => ({ x: point.longitude * Math.PI / 180, y: -Math.log(Math.tan(Math.PI / 4 + point.latitude * Math.PI / 360)) });
  const points = provinces.flatMap(province => [...province.polygons, ...province.holes].flat()).map(project);
  if (!points.length) return { viewBox: '0 0 1 1', paths: [] };
  const xs = points.map(point => point.x); const ys = points.map(point => point.y);
  const west = Math.min(...xs), east = Math.max(...xs), north = Math.min(...ys), south = Math.max(...ys);
  const width = Math.max(east - west, 0.00001), height = Math.max(south - north, 0.00001);
  return { viewBox: `${west - width * 0.05} ${north - height * 0.05} ${width * 1.1} ${height * 1.1}`, paths: provinces.map(province => ({ id: province.id, name: province.name,
    d: [...province.polygons, ...province.holes].map(ring => ring.map((point, index) => { const p = project(point); return `${index ? 'L' : 'M'}${p.x.toFixed(8)},${p.y.toFixed(8)}`; }).join(' ') + ' Z').join(' ') })) };
}
