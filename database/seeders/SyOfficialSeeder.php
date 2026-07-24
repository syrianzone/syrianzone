<?php

namespace Database\Seeders;

use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class SyOfficialSeeder extends Seeder
{
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTAtwovmqnk0722ikCNL1RAeoEWyJ2tec3L0-sGHe-0kbmKs0ZPOIyCxOP4e74ndkPooauvG9ZeLTWT/pub?gid=0&single=true&output=csv';

    public function run(): void
    {
        $categories = [
            ['id' => 'governorates', 'label_ar' => 'المحافظات', 'label_en' => 'Governorates', 'order_column' => 1],
            ['id' => 'ministries', 'label_ar' => 'الوزارات', 'label_en' => 'Ministries', 'order_column' => 2],
            ['id' => 'ministers', 'label_ar' => 'الوزراء', 'label_en' => 'Ministers', 'order_column' => 3],
            ['id' => 'public_figures', 'label_ar' => 'الشخصيات العامة', 'label_en' => 'Public Figures', 'order_column' => 4],
            ['id' => 'syndicates', 'label_ar' => 'النقابات', 'label_en' => 'Syndicates', 'order_column' => 5],
            ['id' => 'universities', 'label_ar' => 'الجامعات', 'label_en' => 'Universities', 'order_column' => 6],
            ['id' => 'embassies', 'label_ar' => 'السفارات', 'label_en' => 'Embassies', 'order_column' => 7],
            ['id' => 'other', 'label_ar' => 'أخرى', 'label_en' => 'Other', 'order_column' => 8],
        ];

        foreach ($categories as $cat) {
            OfficialCategory::updateOrCreate(
                ['id' => $cat['id']],
                $cat
            );
        }

        try {
            $response = Http::get(self::CSV_URL);
            if ($response->successful()) {
                $this->importCSV($response->body());
            }
        } catch (\Exception $e) {
            Log::error('Failed to seed syofficial data from CSV: '.$e->getMessage());
        }
    }

    private function importCSV(string $csvText): void
    {
        $lines = explode("\n", trim($csvText));
        if (count($lines) < 2) {
            return;
        }

        $headers = str_getcsv($lines[0]);

        $socialPlatforms = [
            'Facebook URL' => 'facebook',
            'Facebook URL (Secondary)' => 'facebook_secondary',
            'Instagram URL' => 'instagram',
            'Instagram URL (Secondary)' => 'instagram_secondary',
            'LinkedIn URL' => 'linkedin',
            'Telegram URL' => 'telegram',
            'Telegram URL (Secondary)' => 'telegram_secondary',
            'Twitter/X URL' => 'twitter',
            'Twitter/X URL (Secondary)' => 'twitter_secondary',
            'Website URL' => 'website',
            'WhatsApp URL' => 'whatsapp',
            'YouTube URL' => 'youtube',
        ];

        for ($i = 1; $i < count($lines); $i++) {
            if (empty(trim($lines[$i]))) {
                continue;
            }

            $values = str_getcsv($lines[$i]);
            $row = [];
            foreach ($headers as $index => $header) {
                if ($index < count($values)) {
                    $row[trim($header)] = $values[$index];
                }
            }

            $rawCategory = isset($row['Category']) ? strtolower(trim($row['Category'])) : '';
            if (empty($rawCategory)) {
                continue;
            }

            $categorySlug = preg_replace('/\s+/', '_', $rawCategory);

            // Ensure category exists
            if (! OfficialCategory::where('id', $categorySlug)->exists()) {
                OfficialCategory::create([
                    'id' => $categorySlug,
                    'label_ar' => $row['Category'] ?? $categorySlug,
                    'label_en' => ucfirst($categorySlug),
                    'order_column' => 99,
                    'is_active' => true,
                ]);
            }

            $removedUrls = [
                'https://twitter.com/AllltyraN',
                'https://x.com/SanaAjel',
                'https://twitter.com/Syrianborders',
                'https://x.com/SyTransitionalJ',
                'https://youtube.com/@sytransitionalj',
                'https://www.linkedin.com/in/abdulkader-husrieh',
                'https://twitter.com/abulrhmanalamaa',
                'https://www.linkedin.com/in/abdulsalamhaykal/',
                'https://www.linkedin.com/in/hind-aboud-kabawat-9a084b53/',
                'https://www.linkedin.com/in/marwanalhalabi',
                'https://x.com/IdlebPolitical',
                'https://x.com/SyrianMoiSpokes',
                'https://twitter.com/obaidaarnaout',
                'https://www.linkedin.com/in/raed-alsaleh-68590ab8',
                'https://www.linkedin.com/in/yarob-badr-08b4986',
                'https://www.linkedin.com/in/yisr-barnieh-3846a88a',
            ];

            $socials = [];
            foreach ($socialPlatforms as $columnHeader => $key) {
                $url = trim($row[$columnHeader] ?? '');
                if (! empty($url) && ! in_array($url, $removedUrls)) {
                    $socials[$key] = $url;
                }
            }

            $id = $row['ID'] ?? "entity-{$i}";
            $image = $row['Image Path'] ?? '';
            if (($image === 'images/governorates/placeholder.webp' || empty($image)) && str_starts_with($id, 'gov-')) {
                if ($id === 'gov-raqqa') {
                    $image = 'images/governorates/gov-raqqa.webp';
                } elseif ($id === 'gov-hasakah') {
                    $image = 'images/governorates/gov-hasakah.webp';
                }
            }

            // Auto-upload local asset to R2 if R2 disk is configured, optimized to 200x200 WebP
            $mediaDisk = config('filesystems.media_disk');
            if ($mediaDisk === 'r2' && ! empty($image) && ! str_starts_with($image, 'http')) {
                $localPath = public_path("syofficial-assets/{$image}");
                if (file_exists($localPath)) {
                    $r2Path = 'syofficial/entities/'.basename($image);
                    $content = file_get_contents($localPath);
                    if (function_exists('imagecreatefromstring')) {
                        $im = @imagecreatefromstring($content);
                        if ($im !== false) {
                            $targetW = 200;
                            $targetH = 200;
                            $canvas = imagecreatetruecolor($targetW, $targetH);
                            imagealphablending($canvas, false);
                            imagesavealpha($canvas, true);
                            $transparent = imagecolorallocatealpha($canvas, 255, 255, 255, 127);
                            imagefilledrectangle($canvas, 0, 0, $targetW, $targetH, $transparent);
                            imagecopyresampled($canvas, $im, 0, 0, 0, 0, $targetW, $targetH, imagesx($im), imagesy($im));
                            ob_start();
                            imagewebp($canvas, null, 85);
                            imagedestroy($canvas);
                            imagedestroy($im);
                            $content = ob_get_clean();
                        }
                    }
                    Storage::disk('r2')->put($r2Path, $content, 'public');
                    $image = Storage::disk('r2')->url($r2Path);
                }
            }

            OfficialEntity::updateOrCreate(
                ['id' => $id],
                [
                    'category_id' => $categorySlug,
                    'name' => $row['Name (English)'] ?? '',
                    'name_ar' => $row['Name (Arabic)'] ?? '',
                    'description' => $row['Description (English)'] ?? null,
                    'description_ar' => $row['Description (Arabic)'] ?? null,
                    'image' => $image,
                    'socials' => $socials,
                    'order_column' => $i,
                    'is_active' => true,
                ]
            );
        }
    }
}
