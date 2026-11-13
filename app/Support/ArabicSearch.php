<?php

namespace App\Support;

/**
 * The one fold behind every Arabic text comparison in the app.
 *
 * People type the same word four ways: «أحمد» / «احمد», «صلاة» / «صلاه»,
 * «مؤسسة» / «موسسه», with or without diacritics and tatweel. Folding both the
 * query and the stored text to one spelling is what makes a search find it.
 *
 * Three kinds of caller use it:
 *
 * - the stored `*_fold` search columns (`App\Support\SearchFold`, filled by
 *   `App\Models\Concerns\FoldsSearchColumns`), which the search endpoints
 *   compare against a folded query;
 * - `Facts::normalizeName()`, which resolves a governorate spelling to its row;
 * - `SpeakerDirectory::normalizeName()`, which compares person names.
 *
 * The browser folds with the same rules in `resources/js/Lib/arabic.ts`, and
 * `resources/data/search-fold.json` holds the cases both language tests assert,
 * so the two cannot drift unnoticed.
 */
final class ArabicSearch
{
    /** Latin transliteration letters, folded to the letter they stand for. */
    private const LATIN = [
        'ḥ' => 'h',
        'ẖ' => 'h',
        'ḫ' => 'h',
        'ḩ' => 'h',
        'ş' => 's',
        'ṣ' => 's',
        'ţ' => 't',
        'ṭ' => 't',
        'ā' => 'a',
        'ū' => 'u',
        'ī' => 'i',
    ];

    /**
     * Fold `$text` to its comparison form: lowercase, no diacritics or tatweel,
     * one spelling per letter, Latin transliteration without its diacritics,
     * and single spaces. An empty or whitespace-only string folds to ''.
     */
    public static function fold(string $text): string
    {
        $folded = mb_strtolower(trim($text));
        if ($folded === '') {
            return '';
        }

        // Arabic diacritics and tatweel carry no identity here.
        $folded = (string) preg_replace('/[\x{064B}-\x{065F}\x{0670}\x{0640}]/u', '', $folded);
        // The same letter typed with a different hamza, ta marbuta or
        // alef maqsura: أ إ آ ٱ ⇒ ا, ة ⇒ ه, ى ⇒ ي, ؤ ⇒ و, ئ ⇒ ي.
        $folded = str_replace(
            ['أ', 'إ', 'آ', 'ٱ', 'ة', 'ى', 'ؤ', 'ئ'],
            ['ا', 'ا', 'ا', 'ا', 'ه', 'ي', 'و', 'ي'],
            $folded,
        );
        // Latin transliteration: the apostrophe and the dash are separators.
        $folded = str_replace(["'", '`', '’', '‘'], '', $folded);
        $folded = (string) preg_replace('/[\-‐‑‒–—―]/u', ' ', $folded);
        $folded = str_replace(array_keys(self::LATIN), array_values(self::LATIN), $folded);

        return (string) preg_replace('/\s+/u', ' ', $folded);
    }
}
