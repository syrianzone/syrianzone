import raw from '../../../data/transit.json';

/**
 * Transit numbers that more than one surface needs, from
 * `resources/data/transit.json` (PHP reads the same file through
 * `App\Support\Facts`).
 */

/**
 * Default search radius of the "nearby stops" endpoint, in metres. The ceiling
 * (`nearby_stops_radius_max_m`) and the route colour ceiling
 * (`color_index_max`) in the same file are enforced server-side only.
 */
export const NEARBY_STOPS_RADIUS_M: number = raw.nearby_stops_radius_m;
