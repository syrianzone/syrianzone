<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Arabic person-name normalization, honorific stripping, compound prefix joining,
 * patronymic comparison, and slug generation for Government CVs and cross-module linking.
 */
final class ArabicPersonName
{
    /** Normalised names shorter than this never match by containment. */
    public const MIN_MATCH_LENGTH = 6;

    /** Compound name prefixes joined with the following token during comparison. */
    private const COMPOUNDS = [
        'عبد', 'ابو', 'ابي', 'نور', 'علاء', 'محي', 'تقي', 'بهاء', 'ضياء',
        'سيف', 'صلاح', 'جمال', 'كمال', 'شمس', 'عز', 'سعد', 'فخر', 'زين',
    ];

    /**
     * Strip parenthetical nicknames and leading honorifics/titles for display or comparison.
     * Anchored to the start so family names like "الشيخ" or "السيد" are preserved.
     */
    public static function cleanName(string $name): string
    {
        $name = preg_replace('/\([^)]*\)/u', ' ', $name) ?? $name;
        $name = preg_replace('/\s+/u', ' ', trim($name)) ?? trim($name);

        $leadingPattern = '/^(?:(?:الأستاذ|الاستاذ|الدكتورة|الدكتور|دكتورة|دكتور|د\.|المهندسة|المهندس|م\.|القاضي|الشيخ|اللواء|العقيد|العميد|المقدم|الرائد|المستشارة|المستشار|السفيرة|السفير|السيدة|السيد|وزير الطاقة|وزير|معاون|محافظ)(?:\s+|$))+/u';
        $stripped = preg_replace($leadingPattern, '', $name) ?? $name;

        return trim(preg_replace('/\s+/u', ' ', $stripped) ?? $stripped);
    }

    /**
     * Extract leading honorific from a full name if present.
     */
    public static function extractHonorific(string $name): ?string
    {
        if (preg_match('/^\s*(الأستاذ الدكتور|الاستاذ الدكتور|الدكتورة|الدكتور|د\.|المهندسة|المهندس|م\.|القاضي|الشيخ|اللواء|العميد|العقيد|السفير|المستشار)(?=\s|$)/u', $name, $m)) {
            return trim($m[1]);
        }

        return null;
    }

    /**
     * Fold Arabic text and join split compound names (e.g. "عبد القادر" -> "عبدالقادر")
     * while preserving single spaces between tokens.
     */
    public static function foldWithCompounds(string $name): string
    {
        $tokens = self::tokens($name);

        return implode(' ', $tokens);
    }

    /**
     * Strip honorifics, spaces, dots and spelling variants into a single comparison key.
     */
    public static function normalizeName(string $name): string
    {
        return str_replace([' ', '.'], '', ArabicSearch::fold(self::cleanName($name)));
    }

    /**
     * Tokenize a cleaned name into folded tokens, joining compound prefixes like `عبد` or `أبو`.
     *
     * @return array<int, string>
     */
    public static function tokens(string $name): array
    {
        $rawWords = array_values(array_filter(preg_split('/[\s.\-]+/u', trim(self::cleanName($name))) ?: []));

        $tokens = [];
        $count = count($rawWords);
        for ($i = 0; $i < $count; $i++) {
            $w = ArabicSearch::fold($rawWords[$i]);
            if ($w === '') {
                continue;
            }
            if (in_array($w, self::COMPOUNDS, true) && isset($rawWords[$i + 1])) {
                $next = ArabicSearch::fold($rawWords[$i + 1]);
                // Strip leading "ال" in compounds when comparing if needed, or join directly;
                // joining directly matches "عبدالقادر" and "عبد القادر".
                $tokens[] = $w.$next;
                $i++;
            } else {
                $tokens[] = $w;
            }
        }

        return $tokens;
    }

    /**
     * Compare two Arabic person names, accounting for leading titles/prefixes,
     * compound `عبد` variations, optional `ال` on surnames ("عزام الغريب" vs "عزام غريب"),
     * and middle patronymics ("محمد عبد الرحمن تركو" vs "محمد تركو").
     */
    public static function namesMatch(string $a, string $b): bool
    {
        $normA = self::normalizeName($a);
        $normB = self::normalizeName($b);

        if (mb_strlen($normA) < self::MIN_MATCH_LENGTH || mb_strlen($normB) < self::MIN_MATCH_LENGTH) {
            return false;
        }

        if ($normA === $normB || str_ends_with($normA, $normB) || str_ends_with($normB, $normA)) {
            return true;
        }

        $shortA = self::firstAndLastNormalized($a);
        $shortB = self::firstAndLastNormalized($b);

        if ($shortA !== null && $shortA === $shortB) {
            return true;
        }

        $bareA = self::firstAndLastNormalized($a, stripSurnameAl: true);
        $bareB = self::firstAndLastNormalized($b, stripSurnameAl: true);

        return $bareA !== null && $bareA === $bareB;
    }

    /**
     * First and last compound-aware tokens concatenated, or null when fewer than 2 tokens.
     */
    public static function firstAndLastNormalized(string $name, bool $stripSurnameAl = false): ?string
    {
        $tokens = self::tokens($name);
        if (count($tokens) < 2) {
            return null;
        }

        $first = $tokens[0];
        $last = $tokens[count($tokens) - 1];
        if ($stripSurnameAl && str_starts_with($last, 'ال') && mb_strlen($last) > 4) {
            $last = mb_substr($last, 2);
        }

        $combined = $first.$last;

        return mb_strlen($combined) >= self::MIN_MATCH_LENGTH ? $combined : null;
    }

    /**
     * Generate a clean ASCII URL slug from an English or Arabic name/title.
     */
    public static function slug(string $text, string $fallbackPrefix = 'official'): string
    {
        $text = trim($text);
        if ($text === '') {
            return $fallbackPrefix.'-'.Str::lower(Str::random(6));
        }

        $transliterated = self::transliterateArabicToLatin($text);
        $slug = Str::slug($transliterated);

        return $slug !== '' ? mb_substr($slug, 0, 150) : $fallbackPrefix.'-'.Str::lower(Str::random(6));
    }

    /**
     * Basic Arabic-to-Latin transliteration for slug generation when no English name is given.
     */
    private static function transliterateArabicToLatin(string $text): string
    {
        $map = [
            'أ' => 'a', 'إ' => 'i', 'آ' => 'a', 'ٱ' => 'a', 'ا' => 'a',
            'ب' => 'b', 'ت' => 't', 'ث' => 'th', 'ج' => 'j', 'ح' => 'h',
            'خ' => 'kh', 'د' => 'd', 'ذ' => 'dh', 'ر' => 'r', 'ز' => 'z',
            'س' => 's', 'ش' => 'sh', 'ص' => 's', 'ض' => 'd', 'ط' => 't',
            'ظ' => 'z', 'ع' => 'a', 'غ' => 'gh', 'ف' => 'f', 'ق' => 'q',
            'ك' => 'k', 'ل' => 'l', 'م' => 'm', 'ن' => 'n', 'ه' => 'h',
            'ة' => 'a', 'و' => 'w', 'ؤ' => 'u', 'ي' => 'y', 'ى' => 'a',
            'ئ' => 'i', 'ء' => '',
        ];

        $clean = (string) preg_replace('/[\x{064B}-\x{065F}\x{0670}\x{0640}]/u', '', $text);

        return strtr($clean, $map);
    }
}
