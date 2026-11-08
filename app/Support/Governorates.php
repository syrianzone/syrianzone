<?php

namespace App\Support;

/**
 * The fourteen Syrian governorates, keyed by the slugs the weather and prayer
 * endpoints already use, with their Arabic labels.
 *
 * The repo has no shared governorate list yet (each module carries its own
 * constant, and transit's `cities` ids drift from these). New modules should
 * read this class and hand the list to the frontend as a prop rather than
 * adding another copy.
 */
final class Governorates
{
    /** @var array<string, string> slug => Arabic label, in the conventional order */
    public const ALL = [
        'damascus' => 'دمشق',
        'rural-damascus' => 'ريف دمشق',
        'aleppo' => 'حلب',
        'homs' => 'حمص',
        'hama' => 'حماة',
        'latakia' => 'اللاذقية',
        'tartus' => 'طرطوس',
        'idlib' => 'إدلب',
        'deir-ez-zor' => 'دير الزور',
        'raqqa' => 'الرقة',
        'hasakah' => 'الحسكة',
        'daraa' => 'درعا',
        'sweida' => 'السويداء',
        'quneitra' => 'القنيطرة',
    ];

    /**
     * @return array<int, string>
     */
    public static function slugs(): array
    {
        return array_keys(self::ALL);
    }

    public static function label(string $slug): ?string
    {
        return self::ALL[$slug] ?? null;
    }

    /**
     * Resolve an Arabic name (as typed by a person or found in research data)
     * to its slug. Tolerates the common hamza/ta-marbuta spelling variants.
     */
    public static function fromArabic(string $name): ?string
    {
        $normalize = fn (string $s): string => str_replace(
            ['أ', 'إ', 'آ', 'ة', 'ى', ' '],
            ['ا', 'ا', 'ا', 'ه', 'ي', ''],
            trim($s),
        );

        $needle = $normalize($name);
        foreach (self::ALL as $slug => $label) {
            if ($normalize($label) === $needle) {
                return $slug;
            }
        }

        return null;
    }

    /**
     * @return array<int, array{id: string, label: string}>
     */
    public static function options(): array
    {
        $out = [];
        foreach (self::ALL as $slug => $label) {
            $out[] = ['id' => $slug, 'label' => $label];
        }

        return $out;
    }
}
