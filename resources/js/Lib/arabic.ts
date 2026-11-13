/**
 * Fold the spelling variants people mix when typing Arabic (hamza forms,
 * ta marbuta, alif maqsura, waw/yaa hamza, diacritics and tatweel) so searches
 * match «احمد» against «أحمد». Shared by the command palette and page filters.
 *
 * The server folds Arabic the same way in `App\Support\ArabicSearch::fold()`:
 * the two must agree or a query matches on one side of the wire only, so
 * `resources/data/search-fold.json` holds the cases both tests assert.
 */
const LATIN_FOLD: Record<string, string> = {
  ḥ: 'h',
  ẖ: 'h',
  ḫ: 'h',
  ḩ: 'h',
  ş: 's',
  ṣ: 's',
  ţ: 't',
  ṭ: 't',
  ā: 'a',
  ū: 'u',
  ī: 'i',
};

export function normalizeArabic(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/['`’‘]/g, '')
    .replace(/[-‐‑‒–—―]/g, ' ')
    .replace(/[ḥẖḫḩşṣţṭāūī]/g, (letter) => LATIN_FOLD[letter])
    .replace(/\s+/g, ' ');
}
