<?php

declare(strict_types=1);

namespace App\Services\PublicContent;

use App\Models\GovApp;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

final class DirectoryDataService
{
    public const SITES_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCrz7GpfTDmtgKipQd3IqyMPle1ehoG77VO2SQRDqKC9zRRKO3FDI60VoYhA_XqlzoKQ6gZDrIuIjL/pub?output=csv';

    public const PARTIES_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTxa48kbdV2X5Umd3WGDeU7xX5qFVRpyA3uDFhI9w2FAOuxSiGebSpKrVpjU-13XswnNgxHvfWw-sbJ/pub?output=csv';

    public function __construct(private readonly CsvDocument $csv) {}

    /** @return array{categories: list<array<string, mixed>>, entities: list<array<string, mixed>>} */
    public function officialAccounts(): array
    {
        $categories = OfficialCategory::query()
            ->where('is_active', true)
            ->orderBy('order_column')
            ->get();
        $entities = OfficialEntity::query()
            ->where('is_active', true)
            ->whereHas('category', fn ($query) => $query->where('is_active', true))
            ->orderBy('order_column')
            ->get();

        return [
            'categories' => collect($categories)->map(fn (OfficialCategory $category): array => [
                'id' => $category->id,
                'label_ar' => $category->label_ar,
                'label_en' => $category->label_en,
                'icon' => $category->icon,
                'is_active' => (bool) $category->is_active,
                'order_column' => (int) $category->order_column,
            ])->values()->all(),
            'entities' => collect($entities)->map(fn (OfficialEntity $entity): array => [
                'id' => $entity->id,
                'name' => $entity->name,
                'name_ar' => $entity->name_ar,
                'description' => $entity->description ?? '',
                'description_ar' => $entity->description_ar ?? '',
                'image' => $entity->image ?? '',
                'category' => $entity->category_id,
                'socials' => (object) ($entity->socials ?? []),
            ])->values()->all(),
        ];
    }

    /** @return list<array<string, mixed>> */
    public function phonebook(): array
    {
        $categories = PhonebookCategory::query()
            ->where('is_active', true)
            ->orderBy('order_column')
            ->get()
            ->keyBy('id');
        $entries = PhonebookEntry::query()
            ->where('is_active', true)
            ->whereHas('category', fn ($query) => $query->where('is_active', true))
            ->orderBy('order_column')
            ->get();

        return collect($entries)->map(function (PhonebookEntry $entry) use ($categories): array {
            $category = collect($categories)->get($entry->category_id);

            return [
                'id' => $entry->id,
                'category_ar' => $category?->label_ar ?? '',
                'category_en' => $category?->label_en ?? '',
                'name_ar' => $entry->name_ar,
                'name_en' => $entry->name_en ?? '',
                'number' => $entry->number,
                'is_whatsapp' => (bool) $entry->is_whatsapp,
                'source_url' => $entry->source_url ?? '',
            ];
        })->values()->all();
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
        $apps = GovApp::query()
            ->where('is_active', true)
            ->orderBy('order_column')
            ->get();

        return collect($apps)->map(fn (GovApp $app): array => [
            'id' => $app->id,
            'name' => $app->name_ar ?: $app->name,
            'description' => $app->description_ar ?: ($app->description ?? ''),
            'icon' => $app->icon ?? '',
            'images' => array_values($app->images ?? []),
            'links' => array_replace([
                'official' => null,
                'android' => null,
                'apple' => null,
            ], $app->links ?? []),
        ])->values()->all();
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
}
