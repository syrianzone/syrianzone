import type { RouteCollection, MapDataResponse } from './_types';

type TransitTheme = 'damascus-rose' | 'jasmine';

export function transitSummary(
  cities: readonly { routeCount: number; status: 'active' | 'coming_soon' }[],
) {
  const active = cities.filter((city) => city.status === 'active');
  return {
    readyCities: active.filter((city) => city.routeCount > 0).length,
    totalRoutes: active.reduce((total, city) => total + city.routeCount, 0),
  };
}

export function focusTransitMapData(
  data: MapDataResponse,
  routeId: null | string | undefined,
): MapDataResponse {
  if (!routeId) {
    return data;
  }
  return {
    routes: {
      ...data.routes,
      features: data.routes.features.filter(
        (feature) => feature.properties.id === routeId,
      ),
    },
    stops: {
      ...data.stops,
      features: data.stops.features.filter((feature) =>
        feature.properties.routeIds.includes(routeId),
      ),
    },
  };
}

export type RouteCameraTarget =
  | { bounds: [number, number, number, number]; kind: 'bounds' }
  | { center: [number, number]; kind: 'center'; zoom: number };

export function routeCameraTarget(
  routes: RouteCollection,
): RouteCameraTarget | null {
  const coordinates = routes.features
    .flatMap((feature) => feature.geometry.coordinates)
    .filter(
      (coordinate): coordinate is [number, number] =>
        coordinate.length >= 2 &&
        Number.isFinite(coordinate[0]) &&
        Number.isFinite(coordinate[1]),
    );
  if (!coordinates.length) {
    return null;
  }
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  if (
    Math.abs(maxLongitude - minLongitude) < 0.001 &&
    Math.abs(maxLatitude - minLatitude) < 0.001
  ) {
    return {
      center: [
        roundedCoordinate((minLongitude + maxLongitude) / 2),
        roundedCoordinate((minLatitude + maxLatitude) / 2),
      ],
      kind: 'center',
      zoom: 14,
    };
  }
  return {
    bounds: [minLongitude, minLatitude, maxLongitude, maxLatitude],
    kind: 'bounds',
  };
}

function roundedCoordinate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

const governorateSvgKeys: Readonly<Record<string, string>> = {
  aleppo: 'aleppo',
  daraa: 'dar`a',
  damascus: 'damascus',
  'deir-ez-zor': 'dayr az zawr',
  'deir-ezzor': 'dayr az zawr',
  hama: 'hamah',
  hasakah: 'al Ḥasakah',
  homs: 'homs',
  idlib: 'idlib',
  lattakia: 'lattakia',
  quneitra: 'quneitra',
  raqqa: 'ar raqqah',
  'rif-dimashq': 'rif dimashq',
  'rural-damascus': 'rif dimashq',
  sweida: 'as suwayda',
  tartous: 'tartus',
  tartus: 'tartus',
};

export function getGovernorateSvgKey(cityId: string): string {
  return governorateSvgKeys[cityId] ?? cityId;
}

export function transitThemeForApp(isDark: boolean): TransitTheme {
  return isDark ? 'damascus-rose' : 'jasmine';
}
