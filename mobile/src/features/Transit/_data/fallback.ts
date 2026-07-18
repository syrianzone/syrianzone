import type { MapDataResponse } from '../_types';
import damascusRoutes from './damascus/routes';
import damascusStops from './damascus/stops';
import hamaRoutes from './hama/routes';
import hamaStops from './hama/stops';
import tartousRoutes from './tartous/routes';
import tartousStops from './tartous/stops';

const fallbacks: Readonly<Record<string, MapDataResponse>> = {
  damascus: {
    routes: damascusRoutes as unknown as MapDataResponse['routes'],
    stops: damascusStops as unknown as MapDataResponse['stops'],
  },
  hama: {
    routes: hamaRoutes as unknown as MapDataResponse['routes'],
    stops: hamaStops as unknown as MapDataResponse['stops'],
  },
  tartous: {
    routes: tartousRoutes as unknown as MapDataResponse['routes'],
    stops: tartousStops as unknown as MapDataResponse['stops'],
  },
};

export function transitFallback(cityId: string): MapDataResponse | null {
  return fallbacks[cityId] ?? null;
}
