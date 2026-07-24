export const routeColors = [
  '#e8a838',
  '#c44b4b',
  '#4a8fa8',
  '#7ab87a',
  '#d4956a',
  '#9b6bb5',
  '#5ba08a',
  '#c9784a',
] as const;

export function routeColor(index: number): string {
  return routeColors[Math.abs(index) % routeColors.length] ?? routeColors[0];
}

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_lib/mapColors.ts (14 lines)
  confidence: high
  todos:      0
  notes:      Stable route color indexing is shared by every native map layer.
*/
