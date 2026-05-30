<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

class SyOfficialController extends Controller
{
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTAtwovmqnk0722ikCNL1RAeoEWyJ2tec3L0-sGHe-0kbmKs0ZPOIyCxOP4e74ndkPooauvG9ZeLTWT/pub?gid=0&single=true&output=csv';

    /**
     * Display the official accounts page.
     */
    public function index()
    {
        $entities = [];
        try {
            $response = Http::get(self::CSV_URL);
            if ($response->successful()) {
                $entities = $this->parseCSV($response->body());
            }
        } catch (\Exception $e) {
            // Fail silently and return empty
        }

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
            'Facebook URL', 'Instagram URL', 'LinkedIn URL',
            'Telegram URL', 'Telegram URL (Secondary)',
            'Twitter/X URL', 'Website URL', 'WhatsApp URL', 'YouTube URL'
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
            foreach ($socialPlatforms as $platform) {
                $url = $row[$platform] ?? '';
                if (!empty(trim($url))) {
                    $key = str_replace([' url', ' (secondary)', 'twitter/x'], ['', '', 'twitter'], strtolower($platform));
                    $socials[$key] = trim($url);
                }
            }

            $data[] = [
                'id' => $row['ID'] ?? "entity-{$i}",
                'name' => $row['Name (English)'] ?? '',
                'name_ar' => $row['Name (Arabic)'] ?? '',
                'description' => $row['Description (English)'] ?? '',
                'description_ar' => $row['Description (Arabic)'] ?? '',
                'image' => $row['Image Path'] ?? '',
                'category' => preg_replace('/\s+/', '_', $category),
                'socials' => (object)$socials
            ];
        }

        return $data;
    }
}
