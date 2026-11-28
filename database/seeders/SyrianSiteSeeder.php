<?php

namespace Database\Seeders;

use App\Models\SyrianSite;
use App\Services\ExternalData\ExternalSheetCache;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class SyrianSiteSeeder extends Seeder
{
    public const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCrz7GpfTDmtgKipQd3IqyMPle1ehoG77VO2SQRDqKC9zRRKO3FDI60VoYhA_XqlzoKQ6gZDrIuIjL/pub?output=csv';

    public function run(): void
    {
        $rows = [];

        try {
            foreach (ExternalSheetCache::rows(ExternalSheetCache::SITES, self::SHEET_URL, ['رابط الموقع', 'اسم الموقع']) as $index => $row) {
                $urlVal = trim((string) ($row['رابط الموقع'] ?? ''));
                $nameVal = trim((string) ($row['اسم الموقع'] ?? ''));
                if ($urlVal === '' || $nameVal === '') {
                    continue;
                }

                $baseSlug = Str::slug($nameVal) ?: 'site';
                $slug = $baseSlug.'-'.substr(sha1($nameVal.'|'.$urlVal), 0, 8);

                $rows[] = [
                    'slug' => $slug,
                    'name' => $nameVal,
                    'description' => trim((string) ($row['توصيف الموقع'] ?? '')) ?: null,
                    'url' => $urlVal,
                    'category' => trim((string) ($row['نوع الموقع'] ?? '')) ?: null,
                    'tags' => [],
                    'icon_url' => null,
                    'is_active' => true,
                    'sort_order' => $index + 1,
                ];
            }
        } catch (\Throwable $e) {
            $this->command?->warn('Could not fetch Syrian sites sheet: '.$e->getMessage());
        }

        foreach ($rows as $row) {
            SyrianSite::updateOrCreate(
                ['slug' => $row['slug']],
                $row,
            );
        }

        SyrianSite::forgetPublicCache();
    }
}
