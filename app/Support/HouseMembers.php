<?php

namespace App\Support;

use RuntimeException;

/**
 * Cached loader for the 2026 Syrian People's Assembly roster snapshot
 * (`database/seeders/data/house_members_2026.csv`).
 *
 * Memoised once per process like `Facts`, so member detail pages, preview
 * resolvers and the sitemap share one canonical source of truth.
 */
final class HouseMembers
{
    public const OMRAN_SOURCE_URL = 'https://omrandirasat.org/maps/%D9%85%D8%AE%D8%B7%D8%B7-%D8%AA%D9%81%D8%A7%D8%B9%D9%84%D9%8A-%D9%85%D8%AC%D9%84%D8%B3-%D8%A7%D9%84%D8%B4%D8%B9%D8%A8-%D8%A7%D9%84%D8%B3%D9%88%D8%B1%D9%8A-2026/';

    /**
     * @var list<array{
     *     name_ar: string,
     *     governorate_ar: string,
     *     governorate_display_ar: string,
     *     governorate_id: ?string,
     *     district: string,
     *     town: string,
     *     gender: string,
     *     birth_year: string,
     *     age: string,
     *     selection_method: string,
     *     category: string,
     *     status: string,
     *     member_number: string,
     *     management_position: string,
     *     facebook_url: string,
     *     twitter_url: string,
     *     source_url: string
     * }>|null
     */
    private static ?array $rows = null;

    /**
     * @var array<string, array<string, mixed>>|null
     */
    private static ?array $byNumber = null;

    /**
     * @return list<array{
     *     name_ar: string,
     *     governorate_ar: string,
     *     governorate_display_ar: string,
     *     governorate_id: ?string,
     *     district: string,
     *     town: string,
     *     gender: string,
     *     birth_year: string,
     *     age: string,
     *     selection_method: string,
     *     category: string,
     *     status: string,
     *     member_number: string,
     *     management_position: string,
     *     facebook_url: string,
     *     twitter_url: string,
     *     source_url: string
     * }>
     */
    public static function all(): array
    {
        if (self::$rows !== null) {
            return self::$rows;
        }

        $path = database_path('seeders/data/house_members_2026.csv');
        $handle = @fopen($path, 'rb');
        if ($handle === false) {
            throw new RuntimeException("Missing house members snapshot: {$path}");
        }

        try {
            $header = fgetcsv($handle);
            if (! is_array($header) || $header === []) {
                throw new RuntimeException("Malformed house members CSV header: {$path}");
            }

            $rows = [];
            $byNumber = [];
            while (($line = fgetcsv($handle)) !== false) {
                if (count($line) < count($header)) {
                    continue;
                }
                $raw = array_combine($header, array_slice($line, 0, count($header)));
                $memberNumber = trim((string) ($raw['member_number'] ?? ''));
                if ($memberNumber === '') {
                    continue;
                }

                $govRaw = trim((string) ($raw['governorate_ar'] ?? ''));
                $gov = $govRaw !== '' ? Facts::governorateByAnyName($govRaw) : null;

                $record = [
                    'name_ar' => trim((string) ($raw['name_ar'] ?? '')),
                    'governorate_ar' => $govRaw,
                    'governorate_display_ar' => $gov !== null ? (string) $gov['name_ar'] : $govRaw,
                    'governorate_id' => $gov !== null ? (string) $gov['id'] : null,
                    'district' => trim((string) ($raw['district'] ?? '')),
                    'town' => trim((string) ($raw['town'] ?? '')),
                    'gender' => trim((string) ($raw['gender'] ?? '')),
                    'birth_year' => trim((string) ($raw['birth_year'] ?? '')),
                    'age' => trim((string) ($raw['age'] ?? '')),
                    'selection_method' => trim((string) ($raw['selection_method'] ?? '')),
                    'category' => trim((string) ($raw['category'] ?? '')),
                    'status' => trim((string) ($raw['status'] ?? 'active')) ?: 'active',
                    'member_number' => $memberNumber,
                    'management_position' => trim((string) ($raw['management_position'] ?? '')),
                    'facebook_url' => trim((string) ($raw['facebook_url'] ?? '')),
                    'twitter_url' => trim((string) ($raw['twitter_url'] ?? '')),
                    'source_url' => trim((string) ($raw['source_url'] ?? '')),
                ];

                $rows[] = $record;
                $byNumber[$memberNumber] = $record;
            }
        } finally {
            fclose($handle);
        }

        self::$byNumber = $byNumber;

        return self::$rows = $rows;
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function find(string $memberNumber): ?array
    {
        if (! preg_match('/^[0-9]+$/', $memberNumber)) {
            return null;
        }

        self::all();

        return self::$byNumber[$memberNumber] ?? null;
    }

    /**
     * Other members representing the same governorate, ordered by Arabic name.
     *
     * @return list<array{member_number: string, name_ar: string, district: string, management_position: string, selection_method: string}>
     */
    public static function sameGovernorate(string $memberNumber, string $governorateAr): array
    {
        $peers = [];
        foreach (self::all() as $row) {
            if ($row['member_number'] === $memberNumber) {
                continue;
            }
            if ($row['governorate_ar'] !== $governorateAr) {
                continue;
            }
            $peers[] = [
                'member_number' => $row['member_number'],
                'name_ar' => $row['name_ar'],
                'district' => $row['district'],
                'management_position' => $row['management_position'],
                'selection_method' => $row['selection_method'],
            ];
        }

        usort($peers, fn (array $a, array $b) => strcmp($a['name_ar'], $b['name_ar']));

        return $peers;
    }

    public static function sourceUrl(): string
    {
        return self::OMRAN_SOURCE_URL;
    }
}
