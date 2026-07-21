<?php

namespace Database\Seeders;

use App\Models\GovApp;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class GovAppsSeeder extends Seeder
{
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRW4BMKTSgWlF6ppCgGxzVxvFIdADOG7G5MxIuiRuOCysCIdC_BYpLURlyQwOsrsJj_5q_vn7JwheCF/pub?gid=0&single=true&output=csv';

    public function run(): void
    {
        try {
            $response = Http::get(self::CSV_URL);
            if ($response->successful()) {
                $this->importCSV($response->body());
            }
        } catch (\Exception $e) {
            Log::error('Failed to seed govapps data from CSV: ' . $e->getMessage());
        }
    }

    private function importCSV(string $csvText): void
    {
        $lines = explode("\n", trim($csvText));
        if (count($lines) < 2) return;

        $headers = array_map(function($h) { return strtolower(trim($h)); }, str_getcsv($lines[0]));

        $mediaDisk = config('filesystems.media_disk');

        for ($i = 1; $i < count($lines); $i++) {
            if (empty(trim($lines[$i]))) continue;

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

            // Icons & Screenshots
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

            // Stream icon to R2 if R2 is active
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

            // Stream screenshots to R2 if R2 is active
            if ($mediaDisk === 'r2' && !empty($images)) {
                $r2Images = [];
                foreach ($images as $idx => $localImgPath) {
                    $fullLocalPath = public_path($localImgPath);
                    if (!file_exists($fullLocalPath)) continue;

                    $r2ImgPath = "govapps/{$id}/screenshots/screen_" . ($idx + 1) . ".webp";
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
                if (!empty($r2Images)) {
                    $images = $r2Images;
                }
            }

            $links = [
                'official' => $row['official site'] ?? null,
                'android' => $row['android download'] ?? null,
                'apple' => $row['apple download'] ?? null,
            ];

            GovApp::updateOrCreate(
                ['id' => $id],
                [
                    'name' => $nameVal ?? $id,
                    'name_ar' => $nameVal ?? $id,
                    'description' => $row['description'] ?? null,
                    'description_ar' => $row['description'] ?? null,
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
