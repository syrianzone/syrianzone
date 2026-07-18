<?php

declare(strict_types=1);

namespace App\Services\PublicContent;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

final class DirectoryDataService
{
    public const OFFICIAL_ACCOUNTS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTAtwovmqnk0722ikCNL1RAeoEWyJ2tec3L0-sGHe-0kbmKs0ZPOIyCxOP4e74ndkPooauvG9ZeLTWT/pub?gid=0&single=true&output=csv';

    public const PHONEBOOK_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT59DuQe_jOSrhrjVS7J7kB8YdVJiUHMxkB1-LsZc5MlAVFnUQrDXGM0n4qFm5yqQpPqFn5zkhTGgHS/pub?output=csv';

    public const SITES_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCrz7GpfTDmtgKipQd3IqyMPle1ehoG77VO2SQRDqKC9zRRKO3FDI60VoYhA_XqlzoKQ6gZDrIuIjL/pub?output=csv';

    public const PARTIES_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTxa48kbdV2X5Umd3WGDeU7xX5qFVRpyA3uDFhI9w2FAOuxSiGebSpKrVpjU-13XswnNgxHvfWw-sbJ/pub?output=csv';

    public const GOVERNMENT_APPS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRW4BMKTSgWlF6ppCgGxzVxvFIdADOG7G5MxIuiRuOCysCIdC_BYpLURlyQwOsrsJj_5q_vn7JwheCF/pub?gid=0&single=true&output=csv';

    public function __construct(private readonly CsvDocument $csv) {}

    /** @return list<array<string, mixed>> */
    public function officialAccounts(): array
    {
        return $this->cachedCsv(
            'external_syofficial_data',
            self::OFFICIAL_ACCOUNTS_URL,
            fn (string $body): array => $this->parseOfficialAccounts($body),
        );
    }

    /** @return list<array<string, mixed>> */
    public function phonebook(): array
    {
        return $this->cachedCsv(
            'external_phonebook_data',
            self::PHONEBOOK_URL,
            fn (string $body): array => $this->parsePhonebook($body),
        );
    }

    /** @return list<array<string, mixed>> */
    public function sites(): array
    {
        return $this->cachedCsv(
            'external_sites_data',
            self::SITES_URL,
            fn (string $body): array => $this->parseSites($body),
        );
    }

    /** @return list<array<string, mixed>> */
    public function parties(): array
    {
        return $this->cachedCsv(
            'external_party_data',
            self::PARTIES_URL,
            fn (string $body): array => $this->parseParties($body),
        );
    }

    /** @return list<array<string, mixed>> */
    public function governmentApps(): array
    {
        return $this->cachedCsv(
            'external_govapps_data',
            self::GOVERNMENT_APPS_URL,
            fn (string $body): array => $this->parseGovernmentApps($body),
        );
    }

    /**
     * @param  callable(string): list<array<string, mixed>>  $parse
     * @return list<array<string, mixed>>
     */
    private function cachedCsv(string $cacheKey, string $url, callable $parse): array
    {
        return Cache::remember($cacheKey, 600, function () use ($url, $parse): array {
            try {
                $response = Http::timeout(10)->get($url);
                if ($response->successful()) {
                    return $parse($response->body());
                }

                Log::warning('Failed to fetch public directory data.', [
                    'url' => $url,
                    'status' => $response->status(),
                ]);
            } catch (Throwable $error) {
                Log::warning('Failed to fetch public directory data.', [
                    'url' => $url,
                    'error' => $error->getMessage(),
                ]);
            }

            return [];
        });
    }

    /** @return list<array<string, mixed>> */
    private function parseOfficialAccounts(string $body): array
    {
        $socialPlatforms = [
            'Facebook URL',
            'Instagram URL',
            'LinkedIn URL',
            'Telegram URL',
            'Telegram URL (Secondary)',
            'Twitter/X URL',
            'Website URL',
            'WhatsApp URL',
            'YouTube URL',
        ];
        $accounts = [];

        foreach ($this->csv->rows($body) as $csvRow) {
            $row = $csvRow['values'];
            $category = strtolower(trim($row['Category'] ?? ''));
            if ($category === '') {
                continue;
            }

            $socials = [];
            foreach ($socialPlatforms as $platform) {
                $url = trim($row[$platform] ?? '');
                if ($url === '') {
                    continue;
                }

                $key = str_replace(
                    [' url', ' (secondary)', 'twitter/x'],
                    ['', '', 'twitter'],
                    strtolower($platform),
                );
                $socials[$key] = $url;
            }

            $accounts[] = [
                'id' => $row['ID'] ?? "entity-{$csvRow['number']}",
                'name' => $row['Name (English)'] ?? '',
                'name_ar' => $row['Name (Arabic)'] ?? '',
                'description' => $row['Description (English)'] ?? '',
                'description_ar' => $row['Description (Arabic)'] ?? '',
                'image' => $row['Image Path'] ?? '',
                'category' => preg_replace('/\s+/', '_', $category),
                'socials' => (object) $socials,
            ];
        }

        return $accounts;
    }

    /** @return list<array<string, mixed>> */
    private function parsePhonebook(string $body): array
    {
        $numbers = [];

        foreach ($this->csv->rows($body) as $csvRow) {
            $row = array_map(fn (string $value): string => trim($value), $csvRow['values']);
            $number = $row['Number'] ?? '';
            if ($number === '') {
                continue;
            }

            $whatsapp = strtolower($row['Is_WhatsApp'] ?? '');
            $numbers[] = [
                'id' => $row['ID'] ?? "phone-{$csvRow['number']}",
                'category_ar' => $row['Category_AR'] ?? '',
                'category_en' => $row['Category_EN'] ?? '',
                'name_ar' => $row['Name_AR'] ?? '',
                'name_en' => $row['Name_EN'] ?? '',
                'number' => $number,
                'is_whatsapp' => in_array($whatsapp, ['yes', '1', 'true'], true),
                'source_url' => $row['Source_URL'] ?? '',
            ];
        }

        return $numbers;
    }

    /** @return list<array<string, mixed>> */
    private function parseSites(string $body): array
    {
        $sites = [];

        foreach ($this->csv->rows($body) as $csvRow) {
            $row = $csvRow['values'];
            $url = $row['رابط الموقع'] ?? '';
            $name = $row['اسم الموقع'] ?? '';
            if ($url === '' || $name === '') {
                continue;
            }

            $sites[] = [
                'id' => "site-{$csvRow['number']}",
                'name' => $name,
                'url' => $url,
                'type' => $row['نوع الموقع'] ?? '',
                'description' => $row['توصيف الموقع'] ?? '',
            ];
        }

        return $sites;
    }

    /** @return list<array<string, mixed>> */
    private function parseParties(string $body): array
    {
        $parties = [];

        foreach ($this->csv->rows($body, true) as $csvRow) {
            $row = $csvRow['values'];
            $name = $row['name'] ?? '';
            if ($name === '') {
                continue;
            }

            $city = $row['city'] ?? '';
            $country = $row['country of origin'] ?? '';
            $leanings = array_values(array_filter(array_map(
                'trim',
                explode('|', $row['political leanings'] ?? ''),
            )));

            $parties[] = [
                'id' => "org-{$csvRow['number']}",
                'name' => $name,
                'description' => $row['short description'] ?? '',
                'type' => $row['type'] ?? '',
                'country' => $country,
                'city' => $city,
                'formattedLocation' => implode(', ', array_filter([$city, $country])),
                'socialX' => $row['social - x'] ?? '',
                'socialInsta' => $row['social - insta'] ?? '',
                'socialFb' => $row['social - fb'] ?? '',
                'website' => $row['website'] ?? '',
                'manifesto' => $row['manifesto link'] ?? '',
                'email' => $row['email'] ?? '',
                'phone' => $row['phone'] ?? '',
                'lang' => $row['lang'] ?? '',
                'politicalLeanings' => $leanings,
                'mvpMembers' => $row['mvp members'] ?? '',
                'youtube' => $row['social - youtube'] ?? '',
                'telegram' => $row['social - telegram'] ?? '',
            ];
        }

        return $parties;
    }

    /** @return list<array<string, mixed>> */
    private function parseGovernmentApps(string $body): array
    {
        $apps = [];

        foreach ($this->csv->rows($body, true) as $csvRow) {
            $row = $csvRow['values'];
            $name = $row['name'] ?? '';
            $candidateId = $row['id'] ?? $name ?: "app-{$csvRow['number']}";
            $id = preg_replace('/[^a-z0-9\-]/', '', strtolower(trim($candidateId))) ?: "app-{$csvRow['number']}";

            $iconPath = "/assets/apps/{$id}/{$id}icon.png";
            $images = [];
            for ($number = 1; $number <= 10; $number++) {
                $imagePath = "/assets/apps/{$id}/{$id}{$number}.png";
                if (is_file(public_path($imagePath))) {
                    $images[] = $imagePath;
                }
            }

            $apps[] = [
                'id' => $id,
                'name' => $name !== '' ? $name : $id,
                'description' => $row['description'] ?? '',
                'icon' => is_file(public_path($iconPath)) ? $iconPath : '',
                'images' => $images,
                'links' => [
                    'official' => $row['official site'] ?? null,
                    'android' => $row['android download'] ?? null,
                    'apple' => $row['apple download'] ?? null,
                ],
            ];
        }

        return $apps;
    }
}
