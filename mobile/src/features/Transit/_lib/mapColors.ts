export const routeColors = [
  '#e11d48',
  '#2563eb',
  '#16a34a',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#ca8a04',
  '#db2777',
  '#4f46e5',
  '#059669',
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
