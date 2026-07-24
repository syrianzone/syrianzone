import type {
  MapDataResponse,
  RouteFeature,
  RouteProperties,
  StopFeature,
} from '../_types';
import damascusRoutes from './damascus/routes';
import damascusStops from './damascus/stops';
import hamaRoutes from './hama/routes';
import hamaStops from './hama/stops';
import tartousRoutes from './tartous/routes';
import tartousStops from './tartous/stops';

type Coordinate = readonly [number, number];

interface LegacyRouteCollection {
  readonly features: readonly {
    readonly geometry: {
      readonly coordinates: readonly Coordinate[];
      readonly type: 'LineString';
    };
    readonly properties: RouteProperties;
    readonly type: 'Feature';
  }[];
  readonly type: 'FeatureCollection';
}

interface LegacyStopCollection {
  readonly features: readonly {
    readonly geometry: {
      readonly coordinates: Coordinate;
      readonly type: 'Point';
    };
    readonly properties: {
      readonly id: string;
      readonly nameAr: string;
      readonly nameEn?: string | null;
      readonly routeId: string;
      readonly type?: 'stop';
    };
    readonly type: 'Feature';
  }[];
  readonly type: 'FeatureCollection';
}

const fallbacks: Readonly<Record<string, MapDataResponse>> = {
  damascus: normalizeFallback(damascusRoutes, damascusStops),
  hama: normalizeFallback(hamaRoutes, hamaStops),
  tartous: normalizeFallback(tartousRoutes, tartousStops),
};

function normalizeFallback(
  routes: LegacyRouteCollection,
  stops: LegacyStopCollection,
): MapDataResponse {
  const routeFeatures: RouteFeature[] = routes.features.map((feature) => ({
    geometry: {
      // Generated fallback modules are immutable, and map consumers only read coordinates.
      coordinates:
        feature.geometry.coordinates as unknown as RouteFeature['geometry']['coordinates'],
      type: 'LineString',
    },
    properties: { ...feature.properties },
    type: 'Feature',
  }));
  const stopFeatures: StopFeature[] = stops.features.map((feature) => {
    const { routeId, ...properties } = feature.properties;
    return {
      geometry: {
        coordinates: [...feature.geometry.coordinates],
        type: 'Point',
      },
      properties: { ...properties, routeIds: [routeId] },
      type: 'Feature',
    };
  });
  return {
    routes: { features: routeFeatures, type: 'FeatureCollection' },
    stops: { features: stopFeatures, type: 'FeatureCollection' },
  };
}

export function transitFallback(cityId: string): MapDataResponse | null {
  return fallbacks[cityId] ?? null;
}
