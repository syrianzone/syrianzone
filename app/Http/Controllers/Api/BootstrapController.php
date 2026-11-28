<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GovApp;
use App\Models\GovtOfficial;
use App\Models\GovtTenure;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use App\Models\Promise;
use App\Models\SiteSetting;
use App\Models\WildlifeSpecies;
use App\Support\Facts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class BootstrapController extends Controller
{
    public function show(Request $request): JsonResponse|Response
    {
        $payload = [
            'apiVersion' => '1',
            'navigation' => SiteSetting::getNavigation(),
            'popup' => SiteSetting::getPopup(),
            'themes' => $this->themesPayload(),
            'reference' => [
                'governorates' => Facts::governorates(),
                'prayerMethods' => Facts::prayer(),
                'mediaBaseUrl' => $this->mediaBaseUrl(),
            ],
            'datasetVersions' => $this->datasetVersions(),
        ];

        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
        $etag = '"'.substr(sha1($json), 0, 16).'"';
        $cacheControl = 'public, max-age=300, stale-while-revalidate=3600';

        if ($this->matchesIfNoneMatch($request, $etag)) {
            return response('', 304)
                ->header('ETag', $etag)
                ->header('Cache-Control', $cacheControl);
        }

        return response($json, 200)
            ->header('Content-Type', 'application/json; charset=utf-8')
            ->header('ETag', $etag)
            ->header('Cache-Control', $cacheControl);
    }

    /**
     * @return array{defaults: array{light: string, dark: string}, items: array<int, array{id: string, nameAr: string, isDark: bool, bg: string, primary: string}>}
     */
    private function themesPayload(): array
    {
        $themesData = Facts::themes();
        $defaults = $themesData['theme']['defaults'] ?? [];
        $rawThemes = $themesData['themes'] ?? [];

        $items = [];
        foreach ($rawThemes as $theme) {
            if (! is_array($theme) || empty($theme['id'])) {
                continue;
            }
            $items[] = [
                'id' => (string) $theme['id'],
                'nameAr' => (string) ($theme['nameAr'] ?? $theme['id']),
                'isDark' => (bool) ($theme['isDark'] ?? false),
                'bg' => (string) ($theme['bg'] ?? ''),
                'primary' => (string) ($theme['primary'] ?? ''),
            ];
        }

        return [
            'defaults' => [
                'light' => (string) ($defaults['light'] ?? 'nili'),
                'dark' => (string) ($defaults['dark'] ?? 'nili-night'),
            ],
            'items' => $items,
        ];
    }

    private function mediaBaseUrl(): string
    {
        $url = config('filesystems.disks.r2.url')
            ?: Facts::media()['public_base'];

        return rtrim((string) $url, '/');
    }

    /**
     * Compute lightweight version fingerprints for directory datasets so mobile
     * apps only re-fetch directories whose underlying data has changed.
     *
     * @return array<string, string>
     */
    private function datasetVersions(): array
    {
        return Cache::remember('api_v1_bootstrap_dataset_versions', 60, function (): array {
            return [
                'phonebook' => $this->hashParts([
                    $this->tableStamp((new PhonebookEntry)->getTable()),
                    $this->tableStamp((new PhonebookCategory)->getTable()),
                ]),
                'syofficial' => $this->hashParts([
                    $this->tableStamp((new OfficialEntity)->getTable()),
                    $this->tableStamp((new OfficialCategory)->getTable()),
                ]),
                'govapps' => $this->hashParts([
                    $this->tableStamp((new GovApp)->getTable()),
                ]),
                'wildlife' => $this->hashParts([
                    $this->tableStamp((new WildlifeSpecies)->getTable()),
                    $this->fileStamp(resource_path('data/wildlife.json')),
                ]),
                'promises' => $this->hashParts([
                    $this->tableStamp((new Promise)->getTable()),
                    $this->fileStamp(resource_path('data/promises.json')),
                ]),
                'govtcvs' => $this->hashParts([
                    $this->tableStamp((new GovtOfficial)->getTable()),
                    $this->tableStamp((new GovtTenure)->getTable()),
                ]),
                'crossings' => $this->hashParts([
                    $this->tableStamp('crossings'),
                    $this->fileStamp(resource_path('data/crossings.json')),
                ]),
                'ministries' => $this->hashParts([
                    $this->fileStamp(resource_path('data/government/ministries.json')),
                ]),
            ];
        });
    }

    private function tableStamp(string $table): string
    {
        try {
            $row = DB::table($table)
                ->selectRaw('COUNT(*) as cnt, MAX(updated_at) as max_updated')
                ->first();

            return sprintf('%s:%d:%s', $table, (int) ($row->cnt ?? 0), (string) ($row->max_updated ?? ''));
        } catch (\Throwable) {
            return $table.':unavailable';
        }
    }

    private function fileStamp(string $path): string
    {
        if (! is_file($path)) {
            return $path.':missing';
        }

        $mtime = @filemtime($path) ?: 0;
        $size = @filesize($path) ?: 0;

        return sprintf('%s:%d:%d', basename($path), $mtime, $size);
    }

    /**
     * @param  array<int, string>  $parts
     */
    private function hashParts(array $parts): string
    {
        return substr(sha1(implode('|', $parts)), 0, 12);
    }

    private function matchesIfNoneMatch(Request $request, string $etag): bool
    {
        $header = $request->header('If-None-Match');
        if (! is_string($header) || trim($header) === '') {
            return false;
        }

        $target = trim($etag, '"');
        foreach (explode(',', $header) as $candidate) {
            $clean = trim($candidate);
            if ($clean === '*') {
                return true;
            }
            if (str_starts_with($clean, 'W/')) {
                $clean = substr($clean, 2);
            }
            if (trim($clean, '"') === $target) {
                return true;
            }
        }

        return false;
    }
}
