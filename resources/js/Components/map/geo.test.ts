import { describe, expect, it } from 'vitest';
import type { Feature, FeatureCollection, Position } from 'geojson';
import {
  boundsArePoint,
  featureCollectionBounds,
  geometryPositions,
  normalizeFeatureCollection,
  normalizePosition,
  positionsBounds,
} from './geo';

const collection = (features: Feature[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features,
});

const point = (coordinates: Position): Feature => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Point', coordinates },
});

const line = (coordinates: Position[]): Feature => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates },
});

describe('normalizePosition', () => {
  it('flattens the extra nesting some producers add around a point', () => {
    expect(normalizePosition([36.29, 33.51])).toEqual([36.29, 33.51]);
    expect(normalizePosition([[36.29, 33.51]])).toEqual([36.29, 33.51]);
    expect(normalizePosition([[[36.29, 33.51]]])).toEqual([36.29, 33.51]);
  });

  it('rejects anything that is not a finite lng/lat pair', () => {
    expect(normalizePosition([])).toBeNull();
    expect(normalizePosition([36.29])).toBeNull();
    expect(normalizePosition(['36.29', '33.51'])).toBeNull();
    expect(normalizePosition([Number.NaN, 33.51])).toBeNull();
    expect(normalizePosition(null)).toBeNull();
  });
});

describe('geometryPositions', () => {
  it('walks every coordinate of a polygon, ring by ring', () => {
    const positions = geometryPositions({
      type: 'Polygon',
      coordinates: [
        [
          [36, 33],
          [37, 33],
          [37, 34],
          [36, 33],
        ],
      ],
    });
    expect(positions).toEqual([
      [36, 33],
      [37, 33],
      [37, 34],
      [36, 33],
    ]);
  });

  it('walks a GeometryCollection', () => {
    const positions = geometryPositions({
      type: 'GeometryCollection',
      geometries: [
        { type: 'Point', coordinates: [36, 33] },
        { type: 'LineString', coordinates: [[37, 34], [38, 35]] },
      ],
    });
    expect(positions).toEqual([
      [36, 33],
      [37, 34],
      [38, 35],
    ]);
  });
});

describe('bounds', () => {
  it('is null when there is nothing to fit', () => {
    expect(positionsBounds([])).toBeNull();
    expect(featureCollectionBounds(collection([]))).toBeNull();
    expect(featureCollectionBounds(collection([point([Number.NaN, 3])]))).toBeNull();
  });

  it('returns [[west, south], [east, north]] over every feature', () => {
    const bounds = featureCollectionBounds(
      collection([point([36.2, 33.4]), line([[37.1, 34.2], [35.9, 32.8]])]),
    );
    expect(bounds).toEqual([
      [35.9, 32.8],
      [37.1, 34.2],
    ]);
  });

  it('knows when an extent is a single point', () => {
    expect(boundsArePoint([[36, 33], [36, 33]])).toBe(true);
    expect(boundsArePoint([[36, 33], [36.01, 33]])).toBe(false);
  });
});

describe('normalizeFeatureCollection', () => {
  it('parses a JSON string and repairs wrapped point coordinates', () => {
    const raw = JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [[36.29, 33.51]] } }],
    });
    const [feature] = normalizeFeatureCollection(raw).features;
    expect(feature.geometry).toEqual({ type: 'Point', coordinates: [36.29, 33.51] });
  });

  it('accepts a lone Feature and wraps it', () => {
    const normalized = normalizeFeatureCollection(line([[36, 33], [37, 34]]));
    expect(normalized.type).toBe('FeatureCollection');
    expect(normalized.features).toHaveLength(1);
  });

  it('returns an empty collection for anything unusable', () => {
    for (const input of [null, undefined, 'not json', 42, { type: 'FeatureCollection' }]) {
      expect(normalizeFeatureCollection(input)).toEqual({ type: 'FeatureCollection', features: [] });
    }
  });
});
