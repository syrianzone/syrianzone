import type { FeatureCollection, LineString, Point } from 'geojson';

export interface TransitDraftStop {
  coordinates: [number, number];
  nameAr: string;
}

interface PublishedRouteFeature {
  geometry: {
    coordinates: readonly (readonly number[])[];
  };
}

export function appendCoordinate(
  coordinates: readonly [number, number][] | null,
  coordinate: [number, number],
): [number, number][] {
  return [...(coordinates ?? []), coordinate];
}

function distanceToSegmentSquared(
  point: [number, number],
  start: [number, number],
  end: [number, number],
): number {
  const deltaLongitude = end[0] - start[0];
  const deltaLatitude = end[1] - start[1];
  const lengthSquared = deltaLongitude ** 2 + deltaLatitude ** 2;
  if (lengthSquared === 0) {
    return (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2;
  }
  const position = Math.max(0, Math.min(1,
    ((point[0] - start[0]) * deltaLongitude +
      (point[1] - start[1]) * deltaLatitude) / lengthSquared,
  ));
  const projectedLongitude = start[0] + position * deltaLongitude;
  const projectedLatitude = start[1] + position * deltaLatitude;
  return (point[0] - projectedLongitude) ** 2 +
    (point[1] - projectedLatitude) ** 2;
}

export function nearestSegmentInsertIndex(
  coordinates: readonly [number, number][],
  point: [number, number],
): number {
  if (coordinates.length < 2) {
    return coordinates.length;
  }
  let nearestIndex = 1;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = coordinates[index];
    const end = coordinates[index + 1];
    if (!start || !end) {
      continue;
    }
    const distance = distanceToSegmentSquared(point, start, end);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index + 1;
    }
  }
  return nearestIndex;
}

function boundingBox(
  coordinates: readonly (readonly number[])[],
): [number, number, number, number] | null {
  const positions = coordinates.filter(
    (coordinate) =>
      coordinate.length >= 2 &&
      Number.isFinite(coordinate[0]) &&
      Number.isFinite(coordinate[1]),
  );
  if (positions.length < 2) {
    return null;
  }
  const longitudes = positions.map((coordinate) => coordinate[0] as number);
  const latitudes = positions.map((coordinate) => coordinate[1] as number);
  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
}

export function hasPublishedRouteConflict(
  drawnLine: readonly [number, number][],
  routeFeatures: readonly PublishedRouteFeature[],
): boolean {
  const drawnBounds = boundingBox(drawnLine);
  if (!drawnBounds) {
    return false;
  }
  const [minimumLongitude, minimumLatitude, maximumLongitude, maximumLatitude] =
    drawnBounds;
  const drawnArea =
    (maximumLongitude - minimumLongitude) *
    (maximumLatitude - minimumLatitude);
  if (drawnArea <= 0) {
    return false;
  }

  return routeFeatures.some((feature) => {
    const routeBounds = boundingBox(feature.geometry.coordinates);
    if (!routeBounds) {
      return false;
    }
    const [routeMinLongitude, routeMinLatitude, routeMaxLongitude, routeMaxLatitude] =
      routeBounds;
    const overlapWidth =
      Math.min(maximumLongitude, routeMaxLongitude) -
      Math.max(minimumLongitude, routeMinLongitude);
    const overlapHeight =
      Math.min(maximumLatitude, routeMaxLatitude) -
      Math.max(minimumLatitude, routeMinLatitude);
    if (overlapWidth <= 0 || overlapHeight <= 0) {
      return false;
    }
    return (overlapWidth * overlapHeight) / drawnArea > 0.6;
  });
}

export function buildTransitDraftGeoJson(
  drawnLine: readonly [number, number][],
  stops: readonly TransitDraftStop[],
  routeProperties: Readonly<Record<string, unknown>> = {},
): FeatureCollection<LineString | Point> {
  return {
    features: [
      {
        geometry: { coordinates: [...drawnLine], type: 'LineString' },
        properties: { ...routeProperties, type: 'route' },
        type: 'Feature',
      },
      ...stops.map((stop) => ({
        geometry: { coordinates: stop.coordinates, type: 'Point' as const },
        properties: { nameAr: stop.nameAr.trim(), type: 'stop' },
        type: 'Feature' as const,
      })),
    ],
    type: 'FeatureCollection',
  };
}

export function undoCoordinate(
  coordinates: readonly [number, number][] | null,
): [number, number][] | null {
  if (!coordinates || coordinates.length <= 1) {
    return null;
  }
  return coordinates.slice(0, -1);
}

export function moveCoordinate(
  coordinates: readonly [number, number][],
  from: number,
  to: number,
): [number, number][] {
  if (
    from < 0 ||
    to < 0 ||
    from >= coordinates.length ||
    to >= coordinates.length
  ) {
    return [...coordinates];
  }
  const next = [...coordinates];
  const [item] = next.splice(from, 1);
  if (item) {
    next.splice(to, 0, item);
  }
  return next;
}

function orientation(
  a: [number, number],
  b: [number, number],
  c: [number, number],
): number {
  return Math.sign(
    (b[1] - a[1]) * (c[0] - b[0]) -
      (b[0] - a[0]) * (c[1] - b[1]),
  );
}

export function selfIntersections(
  coordinates: readonly [number, number][],
): readonly [number, number][] {
  const intersections: [number, number][] = [];
  const firstCoordinate = coordinates[0];
  const lastCoordinate = coordinates.at(-1);
  const isClosed =
    firstCoordinate !== undefined &&
    lastCoordinate !== undefined &&
    firstCoordinate[0] === lastCoordinate[0] &&
    firstCoordinate[1] === lastCoordinate[1];
  for (let first = 0; first < coordinates.length - 1; first += 1) {
    for (let second = first + 2; second < coordinates.length - 1; second += 1) {
      if (isClosed && first === 0 && second === coordinates.length - 2) {
        continue;
      }
      const a = coordinates[first];
      const b = coordinates[first + 1];
      const c = coordinates[second];
      const d = coordinates[second + 1];
      if (
        a &&
        b &&
        c &&
        d &&
        orientation(a, b, c) !== orientation(a, b, d) &&
        orientation(c, d, a) !== orientation(c, d, b)
      ) {
        intersections.push([first, second]);
      }
    }
  }
  return intersections;
}
