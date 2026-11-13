import raw from '../../../data/places.json';
import { PLACE_CATEGORY_KEYS, type PlaceCategory } from './types';

/**
 * The place vocabulary — categories and moderation statuses — from
 * `resources/data/places.json`, which `App\Services\Places\PlaceRules` and the
 * share-card resolver read on the server too.
 */
function isPlaceCategory(value: string): value is PlaceCategory {
  return (PLACE_CATEGORY_KEYS as readonly string[]).includes(value);
}

export const CATEGORIES: { key: PlaceCategory; label: string; glyph: string }[] = raw.categories.map((category) => {
  if (!isPlaceCategory(category.key)) {
    throw new Error(`Unknown place category in resources/data/places.json: ${category.key}`);
  }
  return { key: category.key, label: category.label, glyph: category.glyph };
});

export const CATEGORY_LABELS = Object.fromEntries(
  CATEGORIES.map((category) => [category.key, category.label]),
) as Record<PlaceCategory, string>;
