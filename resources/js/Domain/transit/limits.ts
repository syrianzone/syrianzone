import raw from '../../../data/transit.json';

/**
 * Transit numbers that more than one surface needs, from
 * `resources/data/transit.json` (PHP reads the same file through
 * `App\Support\Facts`).
 */

/**
 * Default search radius of the "nearby stops" endpoint, in metres. The ceiling
 * (`nearby_stops_radius_max_m`) in the same file is enforced server-side only.
 */
export const NEARBY_STOPS_RADIUS_M: number = raw.nearby_stops_radius_m;

/**
 * The highest `color_index` the server accepts. It is larger than the palette
 * on purpose: a stored index wraps around the palette (`index % length`), on
 * the map and on the server-rendered share card alike.
 */
export const COLOR_INDEX_MAX: number = raw.color_index_max;

/** Categorical route colours, shared with PHP's route share card. */
export const ROUTE_PALETTE: readonly string[] = raw.route_palette;
