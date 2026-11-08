/**
 * Fold the spelling variants people mix when typing Arabic (hamza forms,
 * ta marbuta, alif maqsura, diacritics and tatweel) so searches match
 * «احمد» against «أحمد». Shared by the command palette and page filters.
 */
export function normalizeArabic(text: string): string {
    return text
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .trim();
}
