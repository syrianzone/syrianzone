import { describe, expect, it } from 'vitest';

import { normalizeArabic } from './arabic';
import foldCases from '../../data/search-fold.json';

/**
 * The server folds Arabic with `App\Support\ArabicSearch::fold()` and the
 * browser folds it here. A query has to match the same rows on both sides of
 * the wire, so both languages assert the same case table:
 * `resources/data/search-fold.json` (the PHP twin is
 * `tests/Unit/ArabicSearchTest.php`).
 */
describe('normalizeArabic', () => {
  for (const { note, input, fold } of foldCases) {
    it(`folds ${note} (${JSON.stringify(input)})`, () => {
      expect(normalizeArabic(input)).toBe(fold);
    });
  }

  it('folds both sides of a substring match', () => {
    expect(normalizeArabic('جامع الأموي')).toContain(normalizeArabic('الاموي'));
    expect(normalizeArabic('جامع الأموي')).toContain(normalizeArabic('الأموي'));
  });
});
