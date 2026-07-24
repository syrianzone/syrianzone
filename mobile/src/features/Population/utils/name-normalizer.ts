import { normalizeForMatching } from '@/lib/ported/city-name-standardizer';

export function normalizeCityName(name: string): string {
  return normalizeForMatching(name);
}

/*
PORT STATUS
  source:     resources/js/Pages/Population/utils/name-normalizer.ts (3 lines)
  confidence: high
  todos:      0
  notes:      Population lookups use this source adapter around the shared canonical normalizer.
*/
