import { isCoordinate, isEntityId, matchesSearch, type Coordinate } from '../../domain';
import { array, integer, record, text } from '../../platform/validation';
import facts from '../../../../resources/data/transit.json';

export type DraftStatus = 'pending' | 'approved' | 'rejected';
export type RouteStatus = 'published' | 'disapproved' | 'hidden';
export interface Geometry {
  segments: Coordinate[][];
  stops: { name: string; coordinate: Coordinate }[];
}
export interface Draft {
  id: number;
  cityId: string;
  city: string | null;
  name: string;
  nameEn: string | null;
  price: number | null;
  color: number;
  notes: string | null;
  status: DraftStatus;
  rejection: string | null;
  routeId: string | null;
  linkedName: string | null;
  user: string | null;
  createdAt: string;
  geometry: Geometry;
}
export interface PublishedRoute {
  id: string;
  cityId: string;
  city: string | null;
  name: string;
  nameEn: string | null;
  price: number | null;
  oldPrice: number | null;
  color: number;
  status: RouteStatus;
  stopsCount: number;
  createdAt: string;
}
export interface ActivityLog {
  id: number;
  routeId: string | null;
  action: string;
  description: string;
  user: string | null;
  createdAt: string;
}
export interface RouteStop {
  id: string;
  name: string;
}
export interface Candidate {
  name: string;
  nameEn: string | null;
  price: number | null;
  notes: string | null;
  geometry: Geometry;
  vertexCount: number;
  warnings: string[];
  source: string;
  sourceDescription: string | null;
  suggestedCity: string | null;
}
export interface ImportPreview {
  candidates: Candidate[];
  mid: string | null;
  filtered: number;
}
export interface RouteForm {
  nameAr: string;
  nameEn: string;
  price: string;
  color: number;
}
export interface ImportForm extends RouteForm {
  cityId: string;
  notes: string;
  stops: Geometry['stops'];
}
export const DRAFT_LABELS = { pending: 'قيد الانتظار', approved: 'مقبول', rejected: 'مرفوض' };
export const ROUTE_LABELS = { published: 'منشور', disapproved: 'معطل', hidden: 'مخفي' };
export const LOG_LABELS: Record<string, string> = {
  approved: 'موافقة ونشر',
  rejected: 'رفض مسودة',
  disapproved: 'تعطيل خط',
  restored: 'تفعيل خط',
  hidden: 'إخفاء خط',
  admin_updated: 'تعديل بيانات',
  imported: 'استيراد خريطة',
  combined: 'دمج خطين',
  split: 'تقسيم خط',
  moved: 'نقل لمدينة',
  created: 'إنشاء',
  updated: 'تحديث',
  deleted: 'حذف خط',
  updated_via_draft: 'تحديث من مسودة',
  restored_after_reject: 'استعادة بعد الرفض'
};
export function entityKey(value: unknown): string {
  if (!isEntityId(value)) throw new Error('معرّف النقل غير صالح.');
  return String(value);
}
function positive(value: unknown): number {
  const id = integer(value);
  if (id < 1) throw new Error('معرّف النقل غير صالح.');
  return id;
}
const nullableText = (value: unknown): string | null => (value == null ? null : text(value));
function numeric(value: unknown): number {
  const result = typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;
  return integer(result);
}
const nullableNumber = (value: unknown): number | null => (value == null ? null : numeric(value));
function color(value: unknown): number {
  const index = numeric(value ?? 0);
  if (index < 0 || index > facts.color_index_max) throw new Error('لون الخط غير صالح.');
  return index;
}
function timestamp(value: unknown): string {
  const date = text(value);
  if (!Number.isFinite(Date.parse(date))) throw new Error('تاريخ النقل غير صالح.');
  return date;
}
function nameOf(value: unknown, key: string): string | null {
  return value == null ? null : text(record(value)[key]);
}
function coordinate(value: unknown, unwrap = false): Coordinate {
  let pair = array(value);
  if (unwrap && pair.length === 1 && Array.isArray(pair[0])) pair = pair[0];
  const result = { longitude: pair[0], latitude: pair[1] };
  if (pair.length !== 2 || !isCoordinate(result)) throw new Error('إحداثيات النقل غير صالحة.');
  return result;
}
export function decodeGeometry(value: unknown): Geometry {
  const source = typeof value === 'string' ? (JSON.parse(value) as unknown) : value,
    collection = record(source);
  const features =
    collection.type === 'FeatureCollection'
      ? array(collection.features)
      : collection.type === 'Feature'
        ? [collection]
        : (() => {
            throw new Error('رسم النقل غير صالح.');
          })();
  const segments: Coordinate[][] = [],
    stops: Geometry['stops'] = [];
  if (features.length > 500) throw new Error('رسم النقل يتجاوز الحد المسموح.');
  for (const item of features) {
    const feature = record(item),
      geometry = record(feature.geometry),
      properties = feature.properties == null ? {} : record(feature.properties);
    if (feature.type !== 'Feature') throw new Error('معلم النقل غير صالح.');
    if (geometry.type === 'Point')
      stops.push({ name: text(properties.nameAr ?? properties.name_ar ?? properties.name, ''), coordinate: coordinate(geometry.coordinates, true) });
    else {
      const lines =
        geometry.type === 'LineString'
          ? [array(geometry.coordinates)]
          : geometry.type === 'MultiLineString'
            ? array(geometry.coordinates).map(array)
            : (() => {
                throw new Error('نوع رسم النقل غير مدعوم.');
              })();
      for (const line of lines) {
        if (line.length < 2) throw new Error('كل جزء من المسار يحتاج نقطتين على الأقل.');
        segments.push(line.map((pair) => coordinate(pair)));
      }
    }
  }
  if (segments.reduce((count, line) => count + line.length, 0) > 5000) throw new Error('عدد نقاط الخط يتجاوز 5000 نقطة.');
  return { segments, stops };
}
export function decodeDrafts(value: unknown): Draft[] {
  return array(value).map((item) => {
    const row = record(item),
      status = row.status;
    if (status !== 'pending' && status !== 'approved' && status !== 'rejected') throw new Error('حالة المسودة غير صالحة.');
    return {
      id: positive(row.id),
      cityId: entityKey(row.city_id),
      city: nameOf(row.city, 'name_ar'),
      name: text(row.name_ar),
      nameEn: nullableText(row.name_en),
      price: nullableNumber(row.price),
      color: color(row.color_index),
      notes: nullableText(row.notes),
      status,
      rejection: nullableText(row.rejection_reason),
      routeId: row.route_id == null ? null : entityKey(row.route_id),
      linkedName: nameOf(row.linked_route, 'name_ar'),
      user: nameOf(row.user, 'name'),
      createdAt: timestamp(row.created_at),
      geometry: decodeGeometry(row.geojson)
    };
  });
}
export function decodeRoutes(value: unknown): PublishedRoute[] {
  return array(value).map((item) => {
    const row = record(item),
      status = row.status,
      count = numeric(row.stops_count);
    if ((status !== 'published' && status !== 'disapproved' && status !== 'hidden') || count < 0) throw new Error('حالة الخط غير صالحة.');
    return {
      id: entityKey(row.id),
      cityId: entityKey(row.city_id),
      city: nameOf(row.city, 'name_ar'),
      name: text(row.name_ar),
      nameEn: nullableText(row.name_en),
      price: nullableNumber(row.price_new),
      oldPrice: nullableNumber(row.price_old),
      color: color(row.color_index),
      status,
      stopsCount: count,
      createdAt: timestamp(row.created_at)
    };
  });
}
export function decodeLogs(value: unknown): ActivityLog[] {
  return array(value).map((item) => {
    const row = record(item);
    return {
      id: positive(row.id),
      routeId: row.route_id == null ? null : entityKey(row.route_id),
      action: text(row.action),
      description: text(row.description),
      user: nameOf(row.user, 'name'),
      createdAt: timestamp(row.created_at)
    };
  });
}
export function decodeStops(value: unknown): RouteStop[] {
  return array(value).map((item) => {
    const row = record(item);
    return { id: entityKey(row.id), name: text(row.name_ar) };
  });
}
export function decodeImportPreview(value: unknown): ImportPreview {
  const row = record(value),
    filtered = integer(row.scope_filtered ?? 0);
  if (filtered < 0) throw new Error('عدد الخطوط المستبعدة غير صالح.');
  return {
    mid: nullableText(row.mid),
    filtered,
    candidates: array(row.routes).map((item) => {
      const candidate = record(item),
        source = record(candidate.source),
        geometry = decodeGeometry(candidate.geojson),
        vertexCount = integer(candidate.vertex_count);
      if (!geometry.segments.length || vertexCount < 2) throw new Error('الخط المستورد لا يحتوي مساراً صالحاً.');
      return {
        name: text(candidate.name_ar),
        nameEn: nullableText(candidate.name_en),
        price: nullableNumber(candidate.price),
        notes: nullableText(candidate.notes),
        geometry,
        vertexCount,
        warnings: array(candidate.warnings).map((warning) => text(warning)),
        source: text(source.doc_name),
        sourceDescription: nullableText(source.doc_description),
        suggestedCity: candidate.suggested_city_id == null ? null : entityKey(candidate.suggested_city_id)
      };
    })
  };
}
export function canInCity(permissions: readonly string[], scope: readonly string[] | null, permission: string, cityId: string): boolean {
  return permissions.includes(permission) && (scope === null || scope.includes(cityId));
}
export function filterDrafts(rows: readonly Draft[], status: string, city: string): Draft[] {
  return rows
    .filter((row) => (status === 'all' || row.status === status) && (city === 'all' || row.cityId === city))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
export function nextPending(rows: readonly Draft[], status: string, city: string, actedId: number): number | null {
  const queue = filterDrafts(rows, status, city),
    after = queue.slice(queue.findIndex((row) => row.id === actedId) + 1);
  return (
    (after.find((row) => row.status === 'pending' && row.id !== actedId) ?? queue.find((row) => row.status === 'pending' && row.id !== actedId))
      ?.id ?? null
  );
}
export function filterRoutes(rows: readonly PublishedRoute[], status: string, city: string, query: string): PublishedRoute[] {
  return rows.filter(
    (row) =>
      (status === 'all' || row.status === status) &&
      (city === 'all' || row.cityId === city) &&
      matchesSearch(`${row.name} ${row.nameEn ?? ''}`, query)
  );
}
function requiredName(value: string): string {
  const name = value.trim();
  if (!name || [...name].length > 255) throw new Error('أدخل اسم الخط بالعربية حتى 255 حرفاً.');
  return name;
}
function englishName(value: string): string | null {
  const name = value.trim();
  if ([...name].length > 255) throw new Error('الاسم بالإنجليزية يتجاوز 255 حرفاً.');
  return name || null;
}
function priceValue(value: string, max = Number.MAX_SAFE_INTEGER): number | null {
  const price = value.trim();
  if (!price) return null;
  if (!/^\d+$/.test(price) || !Number.isSafeInteger(Number(price)) || Number(price) > max)
    throw new Error('التعرفة يجب أن تكون عدداً صحيحاً ضمن الحد المسموح.');
  return Number(price);
}
export function routePayload(form: RouteForm) {
  return { name_ar: requiredName(form.nameAr), name_en: englishName(form.nameEn), price_new: priceValue(form.price), color_index: color(form.color) };
}
export function combinePayload(a: PublishedRoute, b: PublishedRoute, name: string, english: string, price: string) {
  if (a.id === b.id || a.cityId !== b.cityId || a.status !== 'published' || b.status !== 'published')
    throw new Error('اختر خطين منشورين مختلفين من المدينة نفسها.');
  return {
    route_a_id: entityKey(a.id),
    route_b_id: entityKey(b.id),
    name_ar: requiredName(name),
    name_en: englishName(english),
    price: priceValue(price)
  };
}
export function splitPayload(routeId: string, stops: readonly RouteStop[], stopId: string, names: readonly [string, string, string, string]) {
  if (!stops.slice(1, -1).some((stop) => stop.id === stopId)) throw new Error('اختر محطة داخلية من هذا الخط.');
  return {
    route_id: entityKey(routeId),
    split_stop_id: entityKey(stopId),
    name_a_ar: requiredName(names[0]),
    name_a_en: englishName(names[1]),
    name_b_ar: requiredName(names[2]),
    name_b_en: englishName(names[3])
  };
}
export function importForm(candidate: Candidate, cityId: string): ImportForm {
  return {
    nameAr: candidate.name,
    nameEn: candidate.nameEn ?? '',
    price: candidate.price == null ? '' : String(candidate.price),
    notes: candidate.notes ?? '',
    color: 0,
    cityId,
    stops: candidate.geometry.stops.map((stop) => ({ ...stop, coordinate: { ...stop.coordinate } }))
  };
}
export function importPayload(candidate: Candidate, form: ImportForm, mode: 'draft' | 'direct', mid: string | null) {
  const metadata = routePayload(form);
  if (form.notes.length > 5000) throw new Error('الملاحظات تتجاوز 5000 حرف.');
  const tuple = (value: Coordinate): [number, number] => {
    if (!isCoordinate(value)) throw new Error('إحداثيات النقل غير صالحة.');
    return [value.longitude, value.latitude];
  };
  const lines = candidate.geometry.segments.map((segment) => segment.map(tuple));
  return {
    city_id: entityKey(form.cityId),
    name_ar: metadata.name_ar,
    name_en: metadata.name_en,
    price: priceValue(form.price, 1000000),
    color_index: metadata.color_index,
    notes: form.notes.trim() || null,
    mode,
    source_mid: mid,
    geojson: {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: lines.length > 1 ? ('MultiLineString' as const) : ('LineString' as const),
            coordinates: lines.length > 1 ? lines : lines[0]!
          }
        },
        ...form.stops.map((stop) => ({
          type: 'Feature' as const,
          properties: { nameAr: stop.name },
          geometry: { type: 'Point' as const, coordinates: tuple(stop.coordinate) }
        }))
      ]
    }
  };
}
export function validateImportFile(file: { name: string; size: number }): void {
  if (!/\.(kml|kmz|geojson|json|xml)$/i.test(file.name) || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > 5 * 1024 * 1024)
    throw new Error('اختر ملف KML أو KMZ أو GeoJSON بحجم لا يتجاوز 5 ميغابايت.');
}
// PORT STATUS: source Transit/admin and Domain/transit API models; confidence medium; todos 1 authenticated device and spatial round-trip verification.
