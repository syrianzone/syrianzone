import type { PlaceCategory } from './types';

export const CATEGORIES: { key: PlaceCategory; label: string }[] = [
  { key: 'historical', label: 'تاريخي' },
  { key: 'natural', label: 'طبيعي' },
  { key: 'cultural', label: 'ثقافي' },
  { key: 'religious', label: 'ديني' },
  { key: 'abandoned', label: 'مهجور' },
  { key: 'viewpoint', label: 'إطلالة' },
  { key: 'market', label: 'سوق' },
  { key: 'other', label: 'أخرى' },
];

export const CATEGORY_LABELS: Record<PlaceCategory, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label]),
) as Record<PlaceCategory, string>;

/*
PORT STATUS
  source:     resources/js/Pages/Places/_lib/categories.ts (16 lines)
  confidence: high
  todos:      0
  notes:      Category keys and Arabic labels remain exact at the API and UI boundary.
*/
