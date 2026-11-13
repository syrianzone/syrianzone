import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';

/**
 * `[[west, south], [east, north]]` — the corner pair both MapLibre and Leaflet
 * accept for a fit, in GeoJSON order (longitude first).
 */
export type Bounds = [[number, number], [number, number]];

const EMPTY_FEATURE_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] };

const SIMPLE_GEOMETRY_TYPES = [
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
] as const;

type SimpleGeometryType = (typeof SIMPLE_GEOMETRY_TYPES)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSimpleGeometryType(value: string): value is SimpleGeometryType {
  return (SIMPLE_GEOMETRY_TYPES as readonly string[]).includes(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * A GeoJSON position, flattening the wrapping some producers add around a
 * point (`[[lng, lat]]`, `[[[lng, lat]]]`). Null when no usable pair exists.
 */
export function normalizePosition(value: unknown): [number, number] | null {
  let current = value;
  while (Array.isArray(current) && Array.isArray(current[0])) {
    current = current[0];
  }
  if (!Array.isArray(current) || current.length < 2) return null;
  const [lng, lat] = current;
  if (!isFiniteNumber(lng) || !isFiniteNumber(lat)) return null;
  return [lng, lat];
}

function collectPositions(value: unknown, out: Position[]): void {
  if (!Array.isArray(value)) return;
  if (typeof value[0] === 'number') {
    const position = normalizePosition(value);
    if (position) out.push(position);
    return;
  }
  for (const child of value) collectPositions(child, out);
}

/** Every `[lng, lat]` a geometry contains, at any nesting depth. */
export function geometryPositions(geometry: Geometry | null | undefined): Position[] {
  if (!geometry) return [];
  const out: Position[] = [];
  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries) out.push(...geometryPositions(child));
    return out;
  }
  collectPositions(geometry.coordinates, out);
  return out;
}

export function positionsBounds(positions: readonly Position[]): Bounds | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const position of positions) {
    const normalized = normalizePosition(position);
    if (!normalized) continue;
    const [lng, lat] = normalized;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  if (!Number.isFinite(west) || !Number.isFinite(south)) return null;
  return [
    [west, south],
    [east, north],
  ];
}

export function featureCollectionBounds(collection: FeatureCollection): Bounds | null {
  return positionsBounds(collection.features.flatMap((feature) => geometryPositions(feature.geometry)));
}

/** True when the pair is degenerate enough that a fit must zoom instead. */
export function boundsArePoint(bounds: Bounds, tolerance = 0.001): boolean {
  const [[west, south], [east, north]] = bounds;
  return Math.abs(east - west) < tolerance && Math.abs(north - south) < tolerance;
}

function isFeatureCollection(value: unknown): value is FeatureCollection {
  return isRecord(value) && value.type === 'FeatureCollection' && Array.isArray(value.features);
}

function normalizeGeometry(value: unknown): Geometry | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;

  if (value.type === 'GeometryCollection') {
    if (!Array.isArray(value.geometries)) return null;
    const geometries: Geometry[] = [];
    for (const child of value.geometries) {
      const geometry = normalizeGeometry(child);
      if (geometry) geometries.push(geometry);
    }
    return { type: 'GeometryCollection', geometries };
  }

  if (!isSimpleGeometryType(value.type)) return null;
  if (!Array.isArray(value.coordinates)) return null;

  if (value.type === 'Point') {
    const position = normalizePosition(value.coordinates);
    return position ? { type: 'Point', coordinates: position } : null;
  }

  // The other geometries keep their coordinates untouched: MapLibre draws them
  // as they are, and an unknown nesting is the producer's problem, not a shape
  // this helper can repair.
  return { type: value.type, coordinates: value.coordinates } as Geometry;
}

function normalizeFeature(value: unknown): Feature | null {
  if (!isRecord(value) || value.type !== 'Feature') return null;
  const geometry = normalizeGeometry(value.geometry);
  if (!geometry) return null;
  const properties = isRecord(value.properties) ? value.properties : {};
  const id = value.id;
  const feature: Feature = { type: 'Feature', geometry, properties };
  if (typeof id === 'string' || typeof id === 'number') feature.id = id;
  return feature;
}

/**
 * A FeatureCollection MapLibre can draw, from the raw JSON an endpoint may send:
 * a string, a single Feature, or a collection with malformed Point coordinates.
 * Returns an empty collection rather than throwing.
 */
export function normalizeFeatureCollection(raw: unknown): FeatureCollection {
  let source = raw;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      return EMPTY_FEATURE_COLLECTION;
    }
  }
  if (isRecord(source) && source.type === 'Feature') {
    const feature = normalizeFeature(source);
    return feature ? { type: 'FeatureCollection', features: [feature] } : EMPTY_FEATURE_COLLECTION;
  }
  if (!isFeatureCollection(source)) return EMPTY_FEATURE_COLLECTION;

  const features: Feature[] = [];
  for (const entry of source.features) {
    const feature = normalizeFeature(entry);
    if (feature) features.push(feature);
  }
  return { type: 'FeatureCollection', features };
}
