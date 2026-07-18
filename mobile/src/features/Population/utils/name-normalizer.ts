export function normalizeCityName(name: string): string {
  if (!name) {
    return '';
  }
  return name.trim().replace(/['`]/g, '').replace(/Ḥ/g, 'H').toLowerCase();
}

/*
PORT STATUS
  source:     resources/js/Pages/Population/utils/name-normalizer.ts (3 lines)
  confidence: high
  todos:      0
  notes:      The source normalization remains available for imported atlas records.
*/
