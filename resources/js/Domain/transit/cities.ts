import seed from './cities.json';

/** One city of the committed transit seed, as the seeder and the city pages name it. */
export interface TransitCitySeed {
  id: string;
  nameAr: string;
  nameEn: string;
  status: 'active' | 'coming_soon';
  routeCount?: number;
  bounds: [[number, number], [number, number]] | null;
  center: [number, number];
  zoom: number;
}

/**
 * The committed city list — seed data, not a second copy of the API. The server
 * renders the live list; the surfaces that have no server payload (the 404's
 * city grid, the global search's transit group) read this, and this module is
 * the one TypeScript reader of the JSON.
 */
export const TRANSIT_CITY_SEED: readonly TransitCitySeed[] = seed as TransitCitySeed[];
