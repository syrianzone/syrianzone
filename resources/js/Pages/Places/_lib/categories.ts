import type { PlaceCategory } from './types';

export const CATEGORIES: { key: PlaceCategory; label: string }[] = [
  { key: 'historical', label: 'تاريخي' },
  { key: 'natural', label: 'طبيعي' },
  { key: 'cultural', label: 'ثقافي' },
  { key: 'religious', label: 'ديني' },
  { key: 'abandoned', label: 'مهجور' },
  { key: 'viewpoint', label: 'إطلالة' },
  { key: 'market', label: 'سوق' },
  { key: 'food', label: 'مأكولات' },
  { key: 'other', label: 'آخر' },
];

export const CATEGORY_LABELS: Record<PlaceCategory, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label]),
) as Record<PlaceCategory, string>;
