<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class SyOfficialController extends Controller
{
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTAtwovmqnk0722ikCNL1RAeoEWyJ2tec3L0-sGHe-0kbmKs0ZPOIyCxOP4e74ndkPooauvG9ZeLTWT/pub?gid=0&single=true&output=csv';

    /**
     * Display the official accounts page.
     */
    public function index()
    {
        $entities = Cache::remember('external_syofficial_data_v5', 600, function () {
            $entities = [];
            try {
                $response = Http::get(self::CSV_URL);
                if ($response->successful()) {
                    $entities = $this->parseCSV($response->body());
                } else {
                    Log::warning('Failed to fetch external syofficial data: HTTP ' . $response->status());
                }
            } catch (\Exception $e) {
                Log::warning('Failed to fetch external data', [
                    'controller' => static::class,
                    'error'      => $e->getMessage(),
                ]);
            }
            return $entities;
        });

        return Inertia::render('SyOfficial/Index', [
            'initialData' => $entities
        ]);
    }

    /**
     * Parse the published spreadsheet CSV data.
     */
    private function parseCSV($csvText)
    {
        $lines = explode("\n", trim($csvText));
        if (count($lines) < 2) return [];

        $headers = str_getcsv($lines[0]);
        $data = [];

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
            if (empty(trim($lines[$i]))) continue;

            $values = str_getcsv($lines[$i]);
            $row = [];
            foreach ($headers as $index => $header) {
                if ($index < count($values)) {
                    $row[trim($header)] = $values[$index];
                }
            }

            $category = isset($row['Category']) ? strtolower(trim($row['Category'])) : '';
            if (empty($category)) continue;

            $socials = [];
            foreach ($socialPlatforms as $columnHeader => $key) {
                $url = $row[$columnHeader] ?? '';
                if (!empty(trim($url))) {
                    $socials[$key] = trim($url);
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

            $data[] = [
                'id' => $id,
                'name' => $row['Name (English)'] ?? '',
                'name_ar' => $row['Name (Arabic)'] ?? '',
                'description' => $row['Description (English)'] ?? '',
                'description_ar' => $row['Description (Arabic)'] ?? '',
                'image' => $image,
                'category' => preg_replace('/\s+/', '_', $category),
                'socials' => (object)$socials
            ];
        }

        return $data;
    }
}
