import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import type { Bounds } from '../geo';

export interface FitBoundsProps {
  /** The extent to show, in GeoJSON order, or null for "nothing to fit yet". */
  bounds: Bounds | null;
  /** Leaflet padding in pixels, `[x, y]`. */
  padding?: [number, number];
  maxZoom?: number;
}

/**
 * Leaflet "fit the map to this extent". The feature decides *which* extent (the
 * whole country, one province, the shapes just received); this only moves the
 * map, and does so when one of the four numbers changes, not merely when the
 * caller hands over a fresh tuple.
 */
export function FitBounds({ bounds, padding = [20, 20], maxZoom }: FitBoundsProps) {
  const map = useMap();
  const [paddingX, paddingY] = padding;
  const west = bounds ? bounds[0][0] : null;
  const south = bounds ? bounds[0][1] : null;
  const east = bounds ? bounds[1][0] : null;
  const north = bounds ? bounds[1][1] : null;

  useEffect(() => {
    if (west === null || south === null || east === null || north === null) return;
    map.fitBounds(
      L.latLngBounds([south, west], [north, east]),
      { padding: [paddingX, paddingY], ...(maxZoom !== undefined ? { maxZoom } : {}) },
    );
  }, [map, west, south, east, north, paddingX, paddingY, maxZoom]);

  return null;
}
