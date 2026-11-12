<?php

namespace App\Services\ExternalData;

use Illuminate\Support\Facades\Cache;

/**
 * The cache entries of the Google-Sheet-backed pages (/party, /sites).
 *
 * Each sheet is stored as a pair: the parsed rows under its key and the moment
 * they were fetched under `{key}_fetched_at`. Both share one TTL, so they are
 * read and written here as one thing, and the sitemap asks this class for the
 * fetch time instead of knowing the companion key.
 */
final class ExternalSheetCache
{
    public const PARTY = 'external_party_data';

    public const SITES = 'external_sites_data';

    /** A failed or empty fetch is never cached, so this is only the happy path. */
    public const TTL_SECONDS = 600;

    /**
     * The cached rows of one sheet and when they were fetched.
     *
     * @return array{0: ?array<int, array<string, mixed>>, 1: ?string}
     */
    public static function read(string $sheet): array
    {
        return [Cache::get($sheet), Cache::get(self::fetchedAtKey($sheet))];
    }

    /**
     * Store one fetch result together with its timestamp.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return string the stored fetch time
     */
    public static function write(string $sheet, array $rows): string
    {
        $fetchedAt = now()->toIso8601String();

        Cache::put($sheet, $rows, self::TTL_SECONDS);
        Cache::put(self::fetchedAtKey($sheet), $fetchedAt, self::TTL_SECONDS);

        return $fetchedAt;
    }

    /**
     * When the sheet was last fetched, or null when it is not cached.
     */
    public static function fetchedAt(string $sheet): ?string
    {
        return Cache::get(self::fetchedAtKey($sheet));
    }

    private static function fetchedAtKey(string $sheet): string
    {
        return $sheet.'_fetched_at';
    }
}
