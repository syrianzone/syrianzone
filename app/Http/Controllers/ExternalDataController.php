<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class ExternalDataController extends Controller
{
    /**
     * Render Syrian ID page.
     */
    public function syid()
    {
        return Inertia::render('SyId/Index');
    }

    /**
     * Render Political Compass custom generator page.
     */
    public function alignment()
    {
        return Inertia::render('Alignment/Index');
    }

    /**
     * Render Syrian Contributors page.
     */
    public function contributors()
    {
        return Inertia::render('SyrianContributors/Index');
    }

    /**
     * Render Legislative Council/House page.
     */
    public function house()
    {
        return Inertia::render('House/Index');
    }

    /**
     * Fetch, parse, and render Syrian Political Organizations.
     */
    public function party()
    {
        $url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTxa48kbdV2X5Umd3WGDeU7xX5qFVRpyA3uDFhI9w2FAOuxSiGebSpKrVpjU-13XswnNgxHvfWw-sbJ/pub?output=csv';
        
        $data = Cache::remember('external_party_data', 600, function () use ($url) {
            $data = [];
            try {
                $response = Http::get($url);
                if ($response->successful()) {
                    $csv = $response->body();
                    $lines = explode("\n", trim($csv));
                    if (count($lines) >= 2) {
                        $headers = array_map(function($h) { return strtolower(trim($h)); }, str_getcsv($lines[0]));
                        for ($i = 1; $i < count($lines); $i++) {
                            if (empty(trim($lines[$i]))) continue;
                            $values = str_getcsv($lines[$i]);
                            $row = [];
                            foreach ($headers as $index => $header) {
                                if ($index < count($values)) {
                                    $row[$header] = $values[$index];
                                }
                            }
                            $name = $row['name'] ?? null;
                            if (!$name) continue;
                            
                            $politicalLeanings = isset($row['political leanings']) && !empty($row['political leanings'])
                                ? array_filter(array_map('trim', explode('|', $row['political leanings'])))
                                : [];
                                
                            $city = $row['city'] ?? '';
                            $country = $row['country of origin'] ?? '';
                            $formattedLocation = implode(', ', array_filter([$city, $country]));
                            
                            $data[] = [
                                'id' => "org-{$i}",
                                'name' => $name,
                                'description' => $row['short description'] ?? '',
                                'type' => $row['type'] ?? '',
                                'country' => $country,
                                'city' => $city,
                                'formattedLocation' => $formattedLocation,
                                'socialX' => $row['social - x'] ?? '',
                                'socialInsta' => $row['social - insta'] ?? '',
                                'socialFb' => $row['social - fb'] ?? '',
                                'website' => $row['website'] ?? '',
                                'manifesto' => $row['manifesto link'] ?? '',
                                'email' => $row['email'] ?? '',
                                'phone' => $row['phone'] ?? '',
                                'lang' => $row['lang'] ?? '',
                                'politicalLeanings' => $politicalLeanings,
                                'mvpMembers' => $row['mvp members'] ?? '',
                                'youtube' => $row['social - youtube'] ?? '',
                                'telegram' => $row['social - telegram'] ?? ''
                            ];
                        }
                    }
                } else {
                    Log::warning('Failed to fetch external party data: HTTP ' . $response->status());
                }
            } catch (\Exception $e) {
                Log::warning('Failed to fetch external party data', [
                    'controller' => static::class,
                    'error'      => $e->getMessage(),
                ]);
            }
            return $data;
        });
        
        return Inertia::render('Party/Index', [
            'initialOrganizations' => $data
        ]);
    }

    /**
     * Fetch, parse, and render Syrian Sites directory.
     */
    public function sites()
    {
        $url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCrz7GpfTDmtgKipQd3IqyMPle1ehoG77VO2SQRDqKC9zRRKO3FDI60VoYhA_XqlzoKQ6gZDrIuIjL/pub?output=csv';
        
        $data = Cache::remember('external_sites_data', 600, function () use ($url) {
            $data = [];
            try {
                $response = Http::get($url);
                if ($response->successful()) {
                    $csv = $response->body();
                    $lines = explode("\n", trim($csv));
                    if (count($lines) >= 2) {
                        $headers = array_map('trim', str_getcsv($lines[0]));
                        for ($i = 1; $i < count($lines); $i++) {
                            if (empty(trim($lines[$i]))) continue;
                            $values = str_getcsv($lines[$i]);
                            $row = [];
                            foreach ($headers as $index => $header) {
                                if ($index < count($values)) {
                                    $row[$header] = $values[$index];
                                }
                            }
                            $urlVal = $row['رابط الموقع'] ?? null;
                            $nameVal = $row['اسم الموقع'] ?? null;
                            if (!$urlVal || !$nameVal) continue;
                            
                            $data[] = [
                                'id' => "site-{$i}",
                                'name' => $nameVal,
                                'url' => $urlVal,
                                'type' => $row['نوع الموقع'] ?? '',
                                'description' => $row['توصيف الموقع'] ?? ''
                            ];
                        }
                    }
                } else {
                    Log::warning('Failed to fetch external sites data: HTTP ' . $response->status());
                }
            } catch (\Exception $e) {
                Log::warning('Failed to fetch external sites data', [
                    'controller' => static::class,
                    'error'      => $e->getMessage(),
                ]);
            }
            return $data;
        });
        
        return Inertia::render('Sites/Index', [
            'initialWebsites' => $data
        ]);
    }
}
