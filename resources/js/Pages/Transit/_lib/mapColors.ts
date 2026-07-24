export const ROUTE_PALETTE = [
  '#e8a838', // saffron gold
  '#c44b4b', // pomegranate red
  '#4a8fa8', // Damascene tile blue
  '#7ab87a', // olive green
  '#d4956a', // terracotta / apricot
  '#9b6bb5', // Byzantine purple
  '#5ba08a', // copper dome patina
  '#c9784a', // burnt sienna
]

export function getRouteColor(colorIndex: number | null | undefined): string {
  const index = typeof colorIndex === 'number' && !isNaN(colorIndex) 
    ? Math.abs(Math.floor(colorIndex)) 
    : typeof colorIndex === 'string' && !isNaN(parseInt(colorIndex, 10))
    ? Math.abs(parseInt(colorIndex, 10))
    : 0
  return ROUTE_PALETTE[index % ROUTE_PALETTE.length]
}

export function buildColorMatch(): unknown {
  return [
    'match',
    ['%', ['to-number', ['coalesce', ['get', 'colorIndex'], ['get', 'color_index'], 0], 0], 8],
    0, getRouteColor(0),
    1, getRouteColor(1),
    2, getRouteColor(2),
    3, getRouteColor(3),
    4, getRouteColor(4),
    5, getRouteColor(5),
    6, getRouteColor(6),
    7, getRouteColor(7),
    getRouteColor(0),
  ]
}

