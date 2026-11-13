import type maplibregl from 'maplibre-gl'
import { MAP_COLOR_TOKENS, type MapColorEntry } from '@/Components/map/mapColors'
import { ROUTE_PALETTE } from '@/Domain/transit/limits'

/**
 * Categorical route colours, not theme colours: a route's `color_index` is
 * stored data, so the table is static and the theme must not repaint it. The
 * table lives in `resources/data/transit.json` because the share card (PHP)
 * draws the same colours.
 */
export { ROUTE_PALETTE }

export const ROUTE_COLOR_COUNT = ROUTE_PALETTE.length

export function getRouteColor(colorIndex: number | string | null | undefined): string {
  const index = typeof colorIndex === 'number' && !isNaN(colorIndex)
    ? Math.abs(Math.floor(colorIndex))
    : typeof colorIndex === 'string' && !isNaN(parseInt(colorIndex, 10))
    ? Math.abs(parseInt(colorIndex, 10))
    : 0
  return ROUTE_PALETTE[index % ROUTE_PALETTE.length]
}

/**
 * `line-color` for the published-routes layer: the route's `colorIndex` wrapped
 * around the palette, the same rule as `getRouteColor`. One key, one reader:
 * the server and the studio both emit `colorIndex` and nothing else.
 */
export function buildColorMatch(): maplibregl.ExpressionSpecification {
  return [
    'to-color',
    [
      'at',
      ['%', ['abs', ['floor', ['to-number', ['get', 'colorIndex'], 0]]], ROUTE_COLOR_COUNT],
      ['literal', [...ROUTE_PALETTE]],
    ],
  ]
}

/**
 * The transit map's own colours. `gold` and `pomegranate` are the feature's two
 * theme accents (the same pair `transit.css` defines), so they follow the
 * active theme; the rest are the transit visual language and stay fixed.
 */
export const TRANSIT_MAP_COLORS = {
  gold: MAP_COLOR_TOKENS.primary,
  pomegranate: MAP_COLOR_TOKENS.destructive,
  stop: '#d4956a',
  userLocation: '#4a8fa8',
  userLocationHalo: 'rgba(74, 143, 168, 0.15)',
  poiMarker: '#8b5cf6',
  markerStroke: '#ffffff',
} satisfies Record<string, MapColorEntry>

export type TransitMapColors = typeof TRANSIT_MAP_COLORS
