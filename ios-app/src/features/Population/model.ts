import { array, finiteNumber, integer, record, text } from '../../platform/validation';
import { externalUrl } from '../../platform/links-model';
import weather from '../../../../resources/data/weather.json';
import { DATA_TYPE_CONFIG, governorateByAnyName, type DataType } from './rules';

export type Position = readonly [number, number];
export interface Province { id: string; pcode: string; name: string; polygons: Position[][][] }
export interface DataSource { id: number; date: string | null; note: string; url: string | null; cities: Record<string, number> }
export interface Rainfall { year: number; rainfall: number; average: number }
export type CountType = 'population' | 'idp' | 'idp_returnees';
export interface Atlas { groups: Record<Exclude<DataType, 'rainfall'>, DataSource[]>; rainfall: Record<string, Rainfall[]> }
export type Metrics = Record<string, number | string | readonly number[] | null>;
export interface EnvironmentalCity {
  name: string; coordinate: { latitude: number; longitude: number } | null; population: number | null;
  current: Metrics; forecast: Metrics; climate: Metrics; historical: Metrics;
  air: { aqi: number | null; estimated: boolean; category: string; recommendation: string } | null;
  drought: { risk: string; classification: string; rainfall: number | null; dryMonths: number[]; wetMonths: number[] } | null;
}
export interface Environment {
  date: string; sources: string[]; count: number; cities: Record<string, EnvironmentalCity>;
  classification: string; challenges: string[]; basins: string[]; findings: string[]; recommendations: string[];
}
function dictionary(value: unknown): Record<string, unknown> { return value == null || (Array.isArray(value) && value.length === 0) ? {} : record(value); }
function nonnegative(value: unknown): number { const number = finiteNumber(value); if (number < 0) throw new Error('قيمة الأطلس غير صالحة.'); return number; }
function optionalNumber(value: unknown): number | null { return value == null ? null : finiteNumber(value); }
function strings(value: unknown): string[] { return value == null ? [] : array(value).map(item => text(item)); }
function point(value: unknown): Position {
  const row = array(value); if (row.length < 2) throw new Error('إحداثيات الخريطة غير صالحة.');
  const longitude = finiteNumber(row[0]), latitude = finiteNumber(row[1]);
  if (Math.abs(longitude) > 180 || Math.abs(latitude) > 85) throw new Error('إحداثيات الخريطة غير صالحة.');
  return [longitude, latitude];
}
function ring(value: unknown): Position[] {
  const result = array(value).map(point); const start = result[0], end = result.at(-1);
  if (result.length < 4 || !start || !end || start[0] !== end[0] || start[1] !== end[1]) throw new Error('حدود المحافظة غير مكتملة.');
  return result;
}
export function decodeGeometry(value: unknown): Province[] {
  const root = record(value); if (root.type !== 'FeatureCollection') throw new Error('خريطة غير صالحة.');
  const ids = new Set<string>();
  return array(root.features).map(raw => {
    const feature = record(raw), props = record(feature.properties), geometry = record(feature.geometry);
    const pcode = text(props.ADM1_PCODE); const governorate = governorateByAnyName(pcode);
    if (!governorate || ids.has(governorate.id)) throw new Error('معرّف المحافظة غير صالح.');
    ids.add(governorate.id);
    const polygons = geometry.type === 'Polygon' ? [array(geometry.coordinates).map(ring)] : geometry.type === 'MultiPolygon' ? array(geometry.coordinates).map(polygon => array(polygon).map(ring)) : null;
    if (!polygons?.length || polygons.some(polygon => !polygon.length)) throw new Error('حدود المحافظة غير صالحة.');
    return { id: governorate.id, pcode, name: text(props.ADM1_AR), polygons };
  });
}
const mercatorY = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
export function projectedPaths(provinces: readonly Province[], width = 1000, height = 850): { id: string; d: string }[] {
  const points = provinces.flatMap(province => province.polygons.flat(2));
  if (!points.length) return [];
  const xs = points.map(position => position[0] * Math.PI / 180), ys = points.map(position => mercatorY(position[1]));
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min((width - 40) / (maxX - minX), (height - 40) / (maxY - minY));
  const offsetX = (width - (maxX - minX) * scale) / 2, offsetY = (height - (maxY - minY) * scale) / 2;
  return provinces.map(province => ({ id: province.id, d: province.polygons.flatMap(polygon => polygon.map(boundary => boundary.map(([longitude, latitude], index) => `${index ? 'L' : 'M'}${((longitude * Math.PI / 180 - minX) * scale + offsetX).toFixed(3)},${((maxY - mercatorY(latitude)) * scale + offsetY).toFixed(3)}`).join(' ') + 'Z')).join(' ') }));
}
function decodeSource(value: unknown): DataSource {
  const row = record(value); const id = integer(row.source_id); if (id < 1) throw new Error('معرّف المصدر غير صالح.');
  const date = row.date == null ? null : text(row.date); if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('تاريخ المصدر غير صالح.');
  return { id, date, note: text(row.note, ''), url: row.source_url == null || row.source_url === '' ? null : externalUrl(text(row.source_url)), cities: Object.fromEntries(Object.entries(dictionary(row.cities)).map(([name, count]) => [name, nonnegative(count)])) };
}
export function decodeAtlas(value: unknown): Atlas {
  const root = record(value), groups = dictionary(root.groups);
  const group = (type: Exclude<DataType, 'rainfall'>) => {
    const rows = groups[type] == null ? [] : array(groups[type]).map(decodeSource);
    if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('مصادر مكررة.');
    return rows;
  };
  return { groups: { population: group('population'), idp: group('idp'), idp_returnees: group('idp_returnees'), environmental: group('environmental') }, rainfall: Object.fromEntries(Object.entries(dictionary(root.rainfall_data)).map(([pcode, rows]) => [pcode, array(rows).map(rawRow => {
    const row = record(rawRow), year = integer(row.year); if (year < 1800 || year > 2500) throw new Error('سنة الهطول غير صالحة.');
    return { year, rainfall: nonnegative(row.rainfall), average: nonnegative(row.rainfall_avg) };
  })])) };
}
export function provinceValue(source: DataSource | undefined, name: string): number | null {
  if (!source) return null;
  const target = governorateByAnyName(name)?.id;
  for (const [key, value] of Object.entries(source.cities)) if (key === name || (target && governorateByAnyName(key)?.id === target)) return value;
  return null;
}
export function latestRainfall(rows: readonly Rainfall[]): Rainfall | null { return rows.reduce<Rainfall | null>((latest, row) => !latest || row.year > latest.year ? row : latest, null); }
export function dynamicThresholds(type: DataType, values: Readonly<Record<string, number>> | null): readonly number[] {
  const config = DATA_TYPE_CONFIG[type];
  if (type === 'rainfall' || type === 'environmental' || !values) return config.thresholds;
  const positive = Object.values(values).filter(value => value > 0); if (!positive.length) return config.thresholds;
  const max = Math.max(...positive); return [Math.floor(max * 0.1), Math.floor(max * 0.4), Math.floor(max * 0.7)];
}
export function toggleComparison(previous: readonly string[], id: string): string[] { return previous.includes(id) ? previous.filter(value => value !== id) : [...previous.slice(-1), id]; }
function metrics(value: unknown, numbers: readonly string[], texts: readonly string[] = []): Metrics {
  const row = dictionary(value); if (!Object.keys(row).length) return {};
  return Object.fromEntries([...numbers.map(key => [key, optionalNumber(row[key])]), ...texts.map(key => [key, text(row[key], '')])]);
}
const CURRENT = ['temperature_celsius', 'feels_like_celsius', 'humidity_percent', 'wind_speed_kmh', 'wind_direction_degrees', 'pressure_msl_hpa', 'pressure_surface_hpa', 'cloud_cover_percent', 'precipitation_mm'];
const FORECAST = ['tomorrow_max_temp_c', 'tomorrow_min_temp_c', 'tomorrow_precipitation_mm'];
const CLIMATE = ['temperature_trend_celsius', 'temperature_change_rate_per_year', 'rainfall_trend_mm', 'average_annual_rainfall_mm', 'avg_surface_pressure_hpa'];
const HISTORICAL = ['avg_max_temp_c', 'avg_min_temp_c', 'max_wind_speed_kmh', 'total_precipitation_mm', 'avg_surface_pressure_hpa'];
function months(value: unknown): number[] { return value == null ? [] : array(value).map(item => { const month = integer(item); if (month < 1 || month > 12) throw new Error('شهر غير صالح.'); return month; }); }
export function decodeEnvironment(value: unknown): Environment {
  const root = record(value), metadata = dictionary(root.metadata), context = dictionary(dictionary(root.country_level).climate_context), summary = dictionary(root.summary);
  const cities: Record<string, EnvironmentalCity> = {};
  for (const [name, raw] of Object.entries(dictionary(root.cities))) {
    const row = record(raw), air = dictionary(row.air_quality), drought = dictionary(row.drought_risk), coordinates = row.coordinates == null ? null : record(row.coordinates);
    let coordinate = null;
    if (coordinates) { const latitude = finiteNumber(coordinates.latitude), longitude = finiteNumber(coordinates.longitude); if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('إحداثيات التقرير غير صالحة.'); coordinate = { latitude, longitude }; }
    const id = governorateByAnyName(name)?.id ?? name;
    if (cities[id]) throw new Error('محافظة مكررة في التقرير.');
    cities[id] = { name, coordinate, population: row.population == null ? null : nonnegative(row.population),
      current: metrics(row.current_conditions, CURRENT, ['weather_description']), forecast: metrics(row.daily_forecast_summary, FORECAST), climate: metrics(row.climate_trends, CLIMATE), historical: metrics(row.historical_summary, HISTORICAL, ['period_start', 'period_end']),
      air: Object.keys(air).length ? { aqi: air.estimated_aqi == null ? null : nonnegative(air.estimated_aqi), estimated: air.estimated === true, category: text(air.category, ''), recommendation: text(air.health_recommendation, '') } : null,
      drought: Object.keys(drought).length ? { risk: text(drought.drought_risk, ''), classification: text(drought.classification, ''), rainfall: drought.annual_precipitation_mm == null ? null : nonnegative(drought.annual_precipitation_mm), dryMonths: months(drought.dry_season_months), wetMonths: months(drought.wet_season_months) } : null };
  }
  return { date: text(metadata.report_date, ''), sources: strings(metadata.data_sources), count: metadata.cities_analyzed == null ? Object.keys(cities).length : integer(metadata.cities_analyzed), cities, classification: text(context.classification, ''), challenges: strings(context.main_climate_challenges), basins: strings(context.key_water_basins), findings: strings(summary.key_findings), recommendations: strings(summary.recommendations) };
}
const weatherLabels = new Map([...weather.codes, ...weather.descriptions].map(row => [row.en.trim().toLowerCase(), row.label]));
export const weatherDescription = (value: string): string => weatherLabels.get(value.trim().toLowerCase()) ?? value;
export function windDirection(degrees: number): string { return ['شمال', 'شمال شرقي', 'شرق', 'جنوب شرقي', 'جنوب', 'جنوب غربي', 'غرب', 'شمال غربي'][((Math.round(degrees / 45) % 8) + 8) % 8] ?? ''; }
// PORT STATUS: source Population/PopulationClient.tsx, types, utils/data-finder.ts and PopulationAtlasController.php; confidence high; todos 0.
