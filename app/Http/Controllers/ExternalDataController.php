<?php

namespace App\Http\Controllers;

use App\Services\ExternalData\ExternalSheetCache;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Inertia\Inertia;

class ExternalDataController extends Controller
{
    public function syid()
    {
        return Inertia::render('SyId/Index');
    }

    public function alignment()
    {
        return Inertia::render('Alignment/Index');
    }

    /**
     * Render Syrian Contributors page.
     *
     * The leaderboard is a static file the page used to fetch in the browser,
     * which left the server-rendered HTML with nothing but a spinner. Sending
     * it as a prop puts the list in the first response.
     */
    public function contributors()
    {
        return Inertia::render('SyrianContributors/Index', [
            'contributors' => $this->contributorsFromFile(),
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function contributorsFromFile(): array
    {
        $file = public_path('contributors.json');
        $decoded = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;

        return is_array($decoded) && array_is_list($decoded) ? $decoded : [];
    }

    public function house()
    {
        // The roster only changes with a deploy (seeder or migration), so it is
        // cached. A failed or empty read is not cached, so a table that appears
        // later (a deploy mid-flight) shows up on the next request.
        $members = Cache::get(\App\Models\HouseMember2026::CACHE_KEY);
        if (! is_array($members)) {
            $members = [];
            try {
                $members = \App\Models\HouseMember2026::query()
                    ->orderBy('governorate_ar')->orderBy('name_ar')
                    ->get()->toArray();
                if ($members !== []) {
                    Cache::put(\App\Models\HouseMember2026::CACHE_KEY, $members, 600);
                }
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('house_members_2026 read failed', ['error' => $e->getMessage()]);
            }
        }

        return Inertia::render('House/Index', [
            'members2026' => $members,
        ]);
    }

    public function party()
    {
        $url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTxa48kbdV2X5Umd3WGDeU7xX5qFVRpyA3uDFhI9w2FAOuxSiGebSpKrVpjU-13XswnNgxHvfWw-sbJ/pub?output=csv';

        [$cached, $fetchedAt] = ExternalSheetCache::read(ExternalSheetCache::PARTY);
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
            $fetchedAt = ExternalSheetCache::write(ExternalSheetCache::PARTY, $data);
        }

        return Inertia::render('Party/Index', [
            'initialOrganizations' => $data,
            'fetchedAt' => $fetchedAt,
        ]);
    }

    private function fetchParty(string $url): array
    {
        $data = [];

        foreach (ExternalSheetCache::rows(ExternalSheetCache::PARTY, $url, ['name'], lowercaseHeaders: true) as $row) {
            $name = $row['name'] ?? null;
            if (! $name) {
                continue;
            }

            $politicalLeanings = isset($row['political leanings']) && ! empty($row['political leanings'])
                ? array_filter(array_map('trim', explode('|', $row['political leanings'])))
                : [];

            $city = $row['city'] ?? '';
            $country = $row['country of origin'] ?? '';
            $formattedLocation = implode(', ', array_filter([$city, $country]));

            // Stable id from the name (not the row number): inserting
            // a row upstream must not renumber every existing id.
            $slug = Str::slug($name) ?: 'org';
            $data[] = [
                'id' => $slug.'-'.substr(sha1(strtolower(trim($name))), 0, 8),
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
                'telegram' => $row['social - telegram'] ?? '',
            ];
        }

        return $data;
    }

    public function sites()
    {
        $url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCrz7GpfTDmtgKipQd3IqyMPle1ehoG77VO2SQRDqKC9zRRKO3FDI60VoYhA_XqlzoKQ6gZDrIuIjL/pub?output=csv';

        [$cached, $fetchedAt] = ExternalSheetCache::read(ExternalSheetCache::SITES);
        if ($cached !== null) {
            return Inertia::render('Sites/Index', [
                'initialWebsites' => $cached,
                'fetchedAt' => $fetchedAt,
            ]);
        }

        $data = $this->fetchSites($url);
        if ($data !== []) {
            $fetchedAt = ExternalSheetCache::write(ExternalSheetCache::SITES, $data);
        }

        return Inertia::render('Sites/Index', [
            'initialWebsites' => $data,
            'fetchedAt' => $fetchedAt,
        ]);
    }

    private function fetchSites(string $url): array
    {
        $data = [];

        foreach (ExternalSheetCache::rows(ExternalSheetCache::SITES, $url, ['رابط الموقع', 'اسم الموقع']) as $row) {
            $urlVal = $row['رابط الموقع'] ?? null;
            $nameVal = $row['اسم الموقع'] ?? null;
            if (! $urlVal || ! $nameVal) {
                continue;
            }

            $slug = Str::slug($nameVal) ?: 'site';
            $data[] = [
                'id' => $slug.'-'.substr(sha1(trim($nameVal).'|'.trim($urlVal)), 0, 8),
                'name' => $nameVal,
                'url' => $urlVal,
                'type' => $row['نوع الموقع'] ?? '',
                'description' => $row['توصيف الموقع'] ?? '',
            ];
        }

        return $data;
    }
}
