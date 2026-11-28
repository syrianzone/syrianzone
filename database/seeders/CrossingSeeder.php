<?php

namespace Database\Seeders;

use App\Models\Crossing;
use App\Services\Governorates\GovernorateGeometry;
use App\Support\Facts;
use Illuminate\Database\Seeder;

class CrossingSeeder extends Seeder
{
    public function run(): void
    {
        $path = resource_path('data/crossings.json');
        if (! is_file($path)) {
            $this->command?->warn("Crossings seed file not found at {$path}");

            return;
        }

        $decoded = json_decode((string) file_get_contents($path), true);
        if (! is_array($decoded) || ! is_array($decoded['crossings'] ?? null)) {
            $this->command?->warn('Invalid crossings.json format');

            return;
        }

        $geometry = null;
        try {
            $geometry = app(GovernorateGeometry::class);
        } catch (\Throwable) {
            $geometry = null;
        }

        foreach ($decoded['crossings'] as $index => $item) {
            if (! is_array($item) || empty($item['slug'])) {
                continue;
            }

            $windows = is_array($item['windows'] ?? null) ? $item['windows'] : [];
            $openingSoon = (bool) ($item['openingSoon'] ?? false);
            $override = is_array($item['override'] ?? null) ? $item['override'] : null;

            $status = $openingSoon
                ? 'opening_soon'
                : (string) ($override['status'] ?? 'open');

            $lat = isset($item['lat']) ? (float) $item['lat'] : null;
            $lng = isset($item['lon']) ? (float) $item['lon'] : null;

            $governorate = null;
            if ($geometry !== null && $lat !== null && $lng !== null) {
                try {
                    $govId = $geometry->governorateIdForPoint($lat, $lng);
                    $gov = $govId !== null ? Facts::governorate($govId) : null;
                    if (is_array($gov) && ! empty($gov['name_ar'])) {
                        $governorate = (string) $gov['name_ar'];
                    }
                } catch (\Throwable) {
                    $governorate = null;
                }
            }

            Crossing::updateOrCreate(
                ['slug' => (string) $item['slug']],
                [
                    'name_ar' => (string) ($item['name'] ?? ''),
                    'name_en' => $item['name_en'] ?? null,
                    'country' => $item['country'] ?? null,
                    'governorate' => $governorate,
                    'type' => (string) ($item['category'] ?? 'crossing'),
                    'status' => $status,
                    'hours_ar' => Crossing::formatWindowsAr($windows),
                    'notes_ar' => $item['opType'] ?? null,
                    'phone' => isset($item['intl']) ? (string) $item['intl'] : null,
                    'lat' => $lat,
                    'lng' => $lng,
                    'sort_order' => (int) ($item['n'] ?? ($index + 1)),
                    'is_active' => true,
                    'meta' => [
                        'n' => $item['n'] ?? ($index + 1),
                        'direction' => $item['direction'] ?? null,
                        'opType' => $item['opType'] ?? null,
                        'windows' => $windows,
                        'mapsUrl' => $item['mapsUrl'] ?? null,
                        'openingSoon' => $openingSoon,
                        'override' => $override,
                    ],
                ],
            );
        }

        Crossing::forgetPublicCache();
    }
}
