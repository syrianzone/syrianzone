<?php

namespace App\Support;

/**
 * The fourteen Syrian governorates, keyed by the slugs the weather and prayer
 * endpoints use.
 *
 * The table itself lives in `resources/data/governorates.json` (see
 * `resources/data/README.md`); this class is the PHP-facing projection used by
 * the promise forms, the importer and the editor. The browser reads the same
 * file through `Domain/geography/governorates.ts`.
 */
final class Governorates
{
    /**
     * @return array<int, string>
     */
    public static function slugs(): array
    {
        return array_keys(self::labels());
    }

    public static function label(string $slug): ?string
    {
        return self::labels()[$slug] ?? null;
    }

    /**
     * Resolve an Arabic name (as typed by a person or found in research data)
     * to its slug, together with every other spelling the shared table accepts.
     */
    public static function fromArabic(string $name): ?string
    {
        $row = Facts::governorateByAnyName($name);

        return $row === null ? null : $row['id'];
    }

    /**
     * @return array<int, array{id: string, label: string}>
     */
    public static function options(): array
    {
        $out = [];
        foreach (self::labels() as $slug => $label) {
            $out[] = ['id' => $slug, 'label' => $label];
        }

        return $out;
    }

    /**
     * slug => Arabic label, in the option order the forms have always shown.
     *
     * @return array<string, string>
     */
    private static function labels(): array
    {
        $rows = Facts::governorates();
        usort($rows, fn (array $a, array $b): int => $a['option_order'] <=> $b['option_order']);

        $out = [];
        foreach ($rows as $row) {
            $out[$row['id']] = $row['name_ar'];
        }

        return $out;
    }
}
