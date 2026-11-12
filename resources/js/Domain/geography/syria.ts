import raw from '../../../data/syria.json';

/**
 * Country-level facts, from `resources/data/syria.json` (PHP reads the same
 * file through `App\Support\Facts`).
 */
export interface SyriaBox {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

export const SYRIA_BOX: SyriaBox = {
  latMin: raw.bbox.lat_min,
  latMax: raw.bbox.lat_max,
  lngMin: raw.bbox.lng_min,
  lngMax: raw.bbox.lng_max,
};

export const SYRIA_TIMEZONE: string = raw.timezone;

/** Latitude bounds as forms print them ("32.0", not "32"). */
export const SYRIA_LAT_MIN_LABEL = SYRIA_BOX.latMin.toFixed(1);
export const SYRIA_LAT_MAX_LABEL = SYRIA_BOX.latMax.toFixed(1);
export const SYRIA_LNG_MIN_LABEL = SYRIA_BOX.lngMin.toFixed(1);
export const SYRIA_LNG_MAX_LABEL = SYRIA_BOX.lngMax.toFixed(1);

export function inSyriaBox(point: { lat: number; lng: number }): boolean {
  return (
    point.lat >= SYRIA_BOX.latMin &&
    point.lat <= SYRIA_BOX.latMax &&
    point.lng >= SYRIA_BOX.lngMin &&
    point.lng <= SYRIA_BOX.lngMax
  );
}
