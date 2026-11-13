<?php

namespace App\Services\ExternalData;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

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

    /**
     * Fetch one CSV sheet, check its header row, and return its rows keyed by
     * header. Empty when anything failed — a non-2xx response, an unreachable
     * host, a header the sheet no longer carries, or a body with no row — so a
     * caller never caches an outage.
     *
     * Both sheets share this body: the fetch, the retry budget and the CSV loop
     * must not exist twice, or a change to one silently leaves the other behind.
     * Each caller keeps only its own row→array mapping.
     *
     * @param  array<int, string>  $requiredHeaders  cells a usable sheet must carry
     * @param  bool  $lowercaseHeaders  the party sheet arrives mixed-case and is
     *                                  matched case-insensitively
     * @return array<int, array<string, string>>
     */
    public static function rows(string $sheet, string $url, array $requiredHeaders, bool $lowercaseHeaders = false): array
    {
        try {
            $response = Http::timeout(8)->retry(2, 500)->get($url);

            if (! $response->successful()) {
                Log::warning("External sheet {$sheet}: HTTP ".$response->status());

                return [];
            }

            $lines = explode("\n", trim($response->body()));
            if (count($lines) < 2) {
                return [];
            }

            $headers = array_map(
                fn (string $header): string => $lowercaseHeaders ? strtolower(trim($header)) : trim($header),
                str_getcsv($lines[0]),
            );

            // A renamed column must fail loudly, not silently drop every row.
            foreach ($requiredHeaders as $required) {
                if (! in_array($required, $headers, true)) {
                    Log::warning("External sheet {$sheet} is missing a required header", ['headers' => $headers]);

                    return [];
                }
            }

            $rows = [];
            for ($i = 1; $i < count($lines); $i++) {
                if (trim($lines[$i]) === '') {
                    continue;
                }

                $values = str_getcsv($lines[$i]);
                $row = [];
                foreach ($headers as $index => $header) {
                    if ($index < count($values)) {
                        $row[$header] = $values[$index];
                    }
                }
                $rows[] = $row;
            }

            return $rows;
        } catch (\Exception $e) {
            Log::warning("External sheet {$sheet}: fetch failed", ['error' => $e->getMessage()]);

            return [];
        }
    }

    private static function fetchedAtKey(string $sheet): string
    {
        return $sheet.'_fetched_at';
    }
}
