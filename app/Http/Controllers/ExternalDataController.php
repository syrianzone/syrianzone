<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Inertia\Inertia;

class ExternalDataController extends Controller
{
    /**
     * Render Syrian ID page.
     */
    public function syid()
    {
        return Inertia::render('SyId/Index');
    }

    /**
     * Render Political Compass custom generator page.
     */
    public function alignment()
    {
        return Inertia::render('Alignment/Index');
    }

    /**
     * Render Syrian Contributors page.
     */
    public function contributors()
    {
        return Inertia::render('SyrianContributors/Index');
    }

    /**
     * Render Legislative Council/House page.
     */
    public function house()
    {
        return Inertia::render('House/Index');
    }

    /**
     * Fetch, parse, and render Syrian Political Organizations.
     */
    public function party()
    {
        $url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTxa48kbdV2X5Umd3WGDeU7xX5qFVRpyA3uDFhI9w2FAOuxSiGebSpKrVpjU-13XswnNgxHvfWw-sbJ/pub?output=csv';

        $cached = Cache::get('external_party_data');
        $fetchedAt = Cache::get('external_party_data_fetched_at');
        if ($cached !== null) {
            return Inertia::render('Party/Index', [
                'initialOrganizations' => $cached,
                'fetchedAt' => $fetchedAt,
            ]);
        }

        $data = $this->fetchParty($url);
        // Never cache an outage: an empty parse (or failed fetch) returns [] for
        // this request only, so the next visitor retries instead of reading a
        // 10-minute blank page.
        if ($data !== []) {
            Cache::put('external_party_data', $data, 600);
            $fetchedAt = now()->toIso8601String();
            Cache::put('external_party_data_fetched_at', $fetchedAt, 600);
        }

        return Inertia::render('Party/Index', [
            'initialOrganizations' => $data,
            'fetchedAt' => $fetchedAt,
        ]);
    }

    private function fetchParty(string $url): array
    {
        $data = [];
        try {
            $response = Http::timeout(8)->retry(2, 500)->get($url);
            if ($response->successful()) {
                $csv = $response->body();
                $lines = explode("\n", trim($csv));
                if (count($lines) >= 2) {
                    $headers = array_map(function($h) { return strtolower(trim($h)); }, str_getcsv($lines[0]));
                    // Header check: a renamed sheet must fail loudly, not silently
                    // drop every row (name/type/city drive filters).
                    if (!in_array('name', $headers, true)) {
                        Log::warning('Party sheet missing name header', ['headers' => $headers]);
                        return [];
                    }
                    for ($i = 1; $i < count($lines); $i++) {
                        if (empty(trim($lines[$i]))) continue;
                        $values = str_getcsv($lines[$i]);
                        $row = [];
                        foreach ($headers as $index => $header) {
                            if ($index < count($values)) {
                                $row[$header] = $values[$index];
                            }
                        }
                        $name = $row['name'] ?? null;
                        if (!$name) continue;

                        $politicalLeanings = isset($row['political leanings']) && !empty($row['political leanings'])
                            ? array_filter(array_map('trim', explode('|', $row['political leanings'])))
                            : [];

                        $city = $row['city'] ?? '';
                        $country = $row['country of origin'] ?? '';
                        $formattedLocation = implode(', ', array_filter([$city, $country]));

                        // Stable id from the name (not the row number): inserting
                        // a row upstream must not renumber every existing id.
                        $slug = Str::slug($name) ?: 'org';
                        $data[] = [
                            'id' => $slug . '-' . substr(sha1(strtolower(trim($name))), 0, 8),
                            'name' => $name,
                            'description' => $row['short description'] ?? '',
                            'type' => $row['type'] ?? '',
                            'country' => $country,
                            'city' => $city,
                            'formattedLocation' => $formattedLocation,
                            'socialX' => $row['social - x'] ?? '',
                            'socialInsta' => $row['social - insta'] ?? '',
                            'socialFb' => $row['social - fb'] ?? '',
                            'website' => $row['website'] ?? '',
                            'manifesto' => $row['manifesto link'] ?? '',
                            'email' => $row['email'] ?? '',
                            'phone' => $row['phone'] ?? '',
                            'lang' => $row['lang'] ?? '',
                            'politicalLeanings' => $politicalLeanings,
                            'mvpMembers' => $row['mvp members'] ?? '',
                            'youtube' => $row['social - youtube'] ?? '',
                            'telegram' => $row['social - telegram'] ?? ''
                        ];
                    }
                }
            } else {
                Log::warning('Failed to fetch external party data: HTTP ' . $response->status());
            }
        } catch (\Exception $e) {
            Log::warning('Failed to fetch external party data', [
                'controller' => static::class,
                'error'      => $e->getMessage(),
            ]);
        }
        return $data;
    }

    /**
     * Fetch, parse, and render Syrian Sites directory.
     */
    public function sites()
    {
        $url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCrz7GpfTDmtgKipQd3IqyMPle1ehoG77VO2SQRDqKC9zRRKO3FDI60VoYhA_XqlzoKQ6gZDrIuIjL/pub?output=csv';

        $cached = Cache::get('external_sites_data');
        $fetchedAt = Cache::get('external_sites_data_fetched_at');
        if ($cached !== null) {
            return Inertia::render('Sites/Index', [
                'initialWebsites' => $cached,
                'fetchedAt' => $fetchedAt,
            ]);
        }

        $data = $this->fetchSites($url);
        if ($data !== []) {
            Cache::put('external_sites_data', $data, 600);
            $fetchedAt = now()->toIso8601String();
            Cache::put('external_sites_data_fetched_at', $fetchedAt, 600);
        }

        return Inertia::render('Sites/Index', [
            'initialWebsites' => $data,
            'fetchedAt' => $fetchedAt,
        ]);
    }

    private function fetchSites(string $url): array
    {
        $data = [];
        try {
            $response = Http::timeout(8)->retry(2, 500)->get($url);
            if ($response->successful()) {
                $csv = $response->body();
                $lines = explode("\n", trim($csv));
                if (count($lines) >= 2) {
                    $headers = array_map('trim', str_getcsv($lines[0]));
                    if (!in_array('رابط الموقع', $headers, true) || !in_array('اسم الموقع', $headers, true)) {
                        Log::warning('Sites sheet missing required headers', ['headers' => $headers]);
                        return [];
                    }
                    for ($i = 1; $i < count($lines); $i++) {
                        if (empty(trim($lines[$i]))) continue;
                        $values = str_getcsv($lines[$i]);
                        $row = [];
                        foreach ($headers as $index => $header) {
                            if ($index < count($values)) {
                                $row[$header] = $values[$index];
                            }
                        }
                        $urlVal = $row['رابط الموقع'] ?? null;
                        $nameVal = $row['اسم الموقع'] ?? null;
                        if (!$urlVal || !$nameVal) continue;

                        $slug = Str::slug($nameVal) ?: 'site';
                        $data[] = [
                            'id' => $slug . '-' . substr(sha1(trim($nameVal) . '|' . trim($urlVal)), 0, 8),
                            'name' => $nameVal,
                            'url' => $urlVal,
                            'type' => $row['نوع الموقع'] ?? '',
                            'description' => $row['توصيف الموقع'] ?? ''
                        ];
                    }
                }
            } else {
                Log::warning('Failed to fetch external sites data: HTTP ' . $response->status());
            }
        } catch (\Exception $e) {
            Log::warning('Failed to fetch external sites data', [
                'controller' => static::class,
                'error'      => $e->getMessage(),
            ]);
        }
        return $data;
    }
}
