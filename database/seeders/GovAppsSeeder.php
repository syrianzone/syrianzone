<?php

namespace Database\Seeders;

use App\Models\GovApp;
use App\Services\GovApps\GovAppService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class GovAppsSeeder extends Seeder
{
    public const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRW4BMKTSgWlF6ppCgGxzVxvFIdADOG7G5MxIuiRuOCysCIdC_BYpLURlyQwOsrsJj_5q_vn7JwheCF/pub?gid=0&single=true&output=csv';

    public const GUIDES_PATH = 'data/govapps_guides.json';

    public function run(): void
    {
        try {
            $response = Http::get(self::CSV_URL);
            if ($response->successful()) {
                $this->importCSV($response->body());
            }
        } catch (\Exception $e) {
            Log::error('Failed to seed govapps data from CSV: '.$e->getMessage());
        }

        self::applyGuides();
    }

    /**
     * Load curated Arabic guide metadata keyed by gov_apps.id.
     *
     * @return array<string, array<string, mixed>>
     */
    public static function loadGuides(): array
    {
        $path = resource_path(self::GUIDES_PATH);
        if (! is_file($path)) {
            return [];
        }

        $decoded = json_decode((string) file_get_contents($path), true);

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * Populate rich guide fields on existing gov_apps rows without overwriting
     * already-populated columns (safe for re-runs, seeders, and deploy migrations).
     */
    public static function applyGuides(): void
    {
        if (! Schema::hasTable('gov_apps') || ! Schema::hasColumn('gov_apps', 'overview_ar')) {
            return;
        }

        $guides = self::loadGuides();
        if ($guides === []) {
            return;
        }

        $validEntityIds = Schema::hasTable('official_entities')
            ? array_flip(DB::table('official_entities')->pluck('id')->all())
            : [];

        $hasOfficialEntityColumn = Schema::hasColumn('gov_apps', 'official_entity_id');
        $hasFeaturesColumn = Schema::hasColumn('gov_apps', 'features');
        $hasRequirementsColumn = Schema::hasColumn('gov_apps', 'requirements');
        $hasFaqsColumn = Schema::hasColumn('gov_apps', 'faqs');
        $hasVerifiedAtColumn = Schema::hasColumn('gov_apps', 'verified_at');

        $apps = GovApp::query()
            ->whereIn('id', array_keys($guides))
            ->get();

        $updated = false;

        foreach ($apps as $app) {
            $guide = $guides[$app->id] ?? null;
            if (! is_array($guide)) {
                continue;
            }

            $guideDescription = isset($guide['description_ar']) && is_string($guide['description_ar'])
                ? trim($guide['description_ar'])
                : '';

            if (blank($app->description_ar) && $guideDescription !== '') {
                $app->description_ar = $guideDescription;
            }

            if (blank($app->description) && $guideDescription !== '') {
                $app->description = $guideDescription;
            }

            if ($hasOfficialEntityColumn && blank($app->official_entity_id)) {
                $entityId = isset($guide['official_entity_id']) && is_string($guide['official_entity_id'])
                    ? trim($guide['official_entity_id'])
                    : '';
                if ($entityId !== '' && isset($validEntityIds[$entityId])) {
                    $app->official_entity_id = $entityId;
                }
            }

            if (blank($app->overview_ar) && filled($guide['overview_ar'] ?? null)) {
                $app->overview_ar = trim((string) $guide['overview_ar']);
            }

            if ($hasFeaturesColumn && (! is_array($app->features) || count($app->features) === 0) && is_array($guide['features'] ?? null) && count($guide['features']) > 0) {
                $app->features = array_values($guide['features']);
            }

            if ($hasRequirementsColumn && (! is_array($app->requirements) || count($app->requirements) === 0) && is_array($guide['requirements'] ?? null) && count($guide['requirements']) > 0) {
                $app->requirements = array_values($guide['requirements']);
            }

            if ($hasFaqsColumn && (! is_array($app->faqs) || count($app->faqs) === 0) && is_array($guide['faqs'] ?? null) && count($guide['faqs']) > 0) {
                $app->faqs = array_values($guide['faqs']);
            }

            if ($hasVerifiedAtColumn && blank($app->verified_at) && filled($guide['verified_at'] ?? null)) {
                $app->verified_at = (string) $guide['verified_at'];
            }

            if ($app->isDirty()) {
                $app->save();
                $updated = true;
            }
        }

        if ($updated) {
            Cache::forget(GovAppService::APPS_CACHE_KEY);
        }
    }

    private function importCSV(string $csvText): void
    {
        $lines = explode("\n", trim($csvText));
        if (count($lines) < 2) {
            return;
        }

        $headers = array_map(function ($h) {
            return strtolower(trim($h));
        }, str_getcsv($lines[0]));

        $mediaDisk = config('filesystems.media_disk');
        $guides = self::loadGuides();

        for ($i = 1; $i < count($lines); $i++) {
            if (empty(trim($lines[$i]))) {
                continue;
            }

            $values = str_getcsv($lines[$i]);
            $row = [];
            foreach ($headers as $index => $header) {
                if ($index < count($values)) {
                    $row[$header] = $values[$index];
                }
            }

            $nameVal = $row['name'] ?? null;
            $idVal = $row['id'] ?? $nameVal ?? "app-{$i}";
            $id = preg_replace('/[^a-z0-9\-]/', '', strtolower(trim($idVal)));
            if (empty($id)) {
                $id = "app-{$i}";
            }

            $iconPath = "/assets/apps/{$id}/{$id}icon.png";
            $hasLocalIcon = file_exists(public_path($iconPath));
            $finalIcon = $hasLocalIcon ? $iconPath : null;

            $images = [];
            for ($n = 1; $n <= 10; $n++) {
                $imgPath = "/assets/apps/{$id}/{$id}{$n}.png";
                if (file_exists(public_path($imgPath))) {
                    $images[] = $imgPath;
                }
            }

            if ($mediaDisk === 'r2' && $hasLocalIcon) {
                $fullLocalPath = public_path($iconPath);
                $r2Path = "govapps/{$id}/icon.webp";
                $content = file_get_contents($fullLocalPath);
                if (function_exists('imagecreatefromstring')) {
                    $im = @imagecreatefromstring($content);
                    if ($im !== false) {
                        $canvas = imagecreatetruecolor(200, 200);
                        imagealphablending($canvas, false);
                        imagesavealpha($canvas, true);
                        $transparent = imagecolorallocatealpha($canvas, 255, 255, 255, 127);
                        imagefilledrectangle($canvas, 0, 0, 200, 200, $transparent);
                        imagecopyresampled($canvas, $im, 0, 0, 0, 0, 200, 200, imagesx($im), imagesy($im));
                        ob_start();
                        imagewebp($canvas, null, 85);
                        imagedestroy($canvas);
                        imagedestroy($im);
                        $content = ob_get_clean();
                    }
                }
                Storage::disk('r2')->put($r2Path, $content, 'public');
                $finalIcon = Storage::disk('r2')->url($r2Path);
            }

            if ($mediaDisk === 'r2' && ! empty($images)) {
                $r2Images = [];
                foreach ($images as $idx => $localImgPath) {
                    $fullLocalPath = public_path($localImgPath);
                    if (! file_exists($fullLocalPath)) {
                        continue;
                    }

                    $r2ImgPath = "govapps/{$id}/screenshots/screen_".($idx + 1).'.webp';
                    $content = file_get_contents($fullLocalPath);
                    if (function_exists('imagecreatefromstring')) {
                        $im = @imagecreatefromstring($content);
                        if ($im !== false) {
                            ob_start();
                            imagewebp($im, null, 85);
                            imagedestroy($im);
                            $content = ob_get_clean();
                        }
                    }
                    Storage::disk('r2')->put($r2ImgPath, $content, 'public');
                    $r2Images[] = Storage::disk('r2')->url($r2ImgPath);
                }
                if (! empty($r2Images)) {
                    $images = $r2Images;
                }
            }

            $links = [
                'official' => $row['official site'] ?? null,
                'android' => $row['android download'] ?? null,
                'apple' => $row['apple download'] ?? null,
            ];

            $existing = GovApp::find($id);
            $csvDescription = trim((string) ($row['description'] ?? ''));
            $guideDescription = isset($guides[$id]['description_ar']) && is_string($guides[$id]['description_ar'])
                ? trim($guides[$id]['description_ar'])
                : '';

            $description = $csvDescription !== ''
                ? $csvDescription
                : ($existing && filled($existing->description) ? $existing->description : ($guideDescription !== '' ? $guideDescription : null));

            $descriptionAr = $csvDescription !== ''
                ? $csvDescription
                : ($existing && filled($existing->description_ar) ? $existing->description_ar : ($guideDescription !== '' ? $guideDescription : null));

            GovApp::updateOrCreate(
                ['id' => $id],
                [
                    'name' => $nameVal ?? $id,
                    'name_ar' => $nameVal ?? $id,
                    'description' => $description,
                    'description_ar' => $descriptionAr,
                    'icon' => $finalIcon,
                    'images' => $images,
                    'links' => array_filter($links),
                    'order_column' => $i,
                    'is_active' => true,
                ]
            );
        }
    }
}
