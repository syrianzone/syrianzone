<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class PhonebookController extends Controller
{
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT59DuQe_jOSrhrjVS7J7kB8YdVJiUHMxkB1-LsZc5MlAVFnUQrDXGM0n4qFm5yqQpPqFn5zkhTGgHS/pub?output=csv';

    /**
     * Display the official phonebook page.
     */
    public function index()
    {
        $numbers = Cache::remember('external_phonebook_data', 600, function () {
            $numbers = [];
            try {
                $response = Http::get(self::CSV_URL);
                if ($response->successful()) {
                    $numbers = $this->parseCSV($response->body());
                } else {
                    Log::warning('Failed to fetch external phonebook data: HTTP ' . $response->status());
                }
            } catch (\Exception $e) {
                Log::warning('Failed to fetch external data', [
                    'controller' => static::class,
                    'error'      => $e->getMessage(),
                ]);
            }
            return $numbers;
        });

        return Inertia::render('Phonebook/Index', [
            'initialData' => $numbers
        ]);
    }

    /**
     * Parse the published spreadsheet CSV data.
     */
    private function parseCSV($csvText)
    {
        $lines = explode("\n", trim($csvText));
        if (count($lines) < 2) return [];

        // Parse headers and clean any byte-order mark (BOM)
        $firstLine = $lines[0];
        if (str_starts_with($firstLine, "\xEF\xBB\xBF")) {
            $firstLine = substr($firstLine, 3);
        }
        $headers = str_getcsv($firstLine);
        $data = [];

        for ($i = 1; $i < count($lines); $i++) {
            if (empty(trim($lines[$i]))) continue;

            $values = str_getcsv($lines[$i]);
            $row = [];
            foreach ($headers as $index => $header) {
                $headerName = trim($header);
                if ($index < count($values)) {
                    $row[$headerName] = trim($values[$index]);
                } else {
                    $row[$headerName] = '';
                }
            }

            $number = $row['Number'] ?? '';
            if (empty($number)) continue;

            $data[] = [
                'id' => $row['ID'] ?? "phone-{$i}",
                'category_ar' => $row['Category_AR'] ?? '',
                'category_en' => $row['Category_EN'] ?? '',
                'name_ar' => $row['Name_AR'] ?? '',
                'name_en' => $row['Name_EN'] ?? '',
                'number' => $number,
                'is_whatsapp' => strtolower($row['Is_WhatsApp'] ?? '') === 'yes' || $row['Is_WhatsApp'] === '1' || strtolower($row['Is_WhatsApp'] ?? '') === 'true',
                'source_url' => $row['Source_URL'] ?? ''
            ];
        }

        return $data;
    }
}
