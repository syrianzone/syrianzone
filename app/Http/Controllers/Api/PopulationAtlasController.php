<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Population\PopulationDemographic;
use App\Models\Population\PopulationEnvironmentalLog;
use App\Models\Population\PopulationRainfall;
use App\Services\Population\PopulationCache;
use App\Support\Facts;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class PopulationAtlasController extends Controller
{
    public const SUMMARY_CACHE_KEY = 'population_atlas_summary';

    public function getData(): JsonResponse
    {
        $data = Cache::remember(PopulationCache::MASTER, 3600, function () {
            return $this->buildMasterData();
        });

        return response()->json($data);
    }

    public function getEnvironmentalDetails(): JsonResponse
    {
        $data = Cache::remember(PopulationCache::ENVIRONMENT, 3600, function () {
            return $this->buildEnvironmentalReport();
        });

        return response()->json($data);
    }

    public function renderIndex()
    {
        // Compact SSR summary: the full atlas (all demographic sources +
        // rainfall years + environmental snapshots) is multi-hundred-KB and
        // stays client-fetched via /api, while the primary governorate
        // population breakdown rides in Inertia props so crawlers and first
        // paint get real figures and internal governorate links.
        $initialSummary = Cache::get(self::SUMMARY_CACHE_KEY);

        if ($initialSummary === null) {
            $initialSummary = $this->buildInitialSummary();
            if ($initialSummary !== null) {
                Cache::put(self::SUMMARY_CACHE_KEY, $initialSummary, 3600);
            }
        }

        return Inertia::render('Population/Index', [
            'initialSummary' => $initialSummary,
        ]);
    }

    /**
     * Compact governorate-level population snapshot for SSR on `/atlas`.
     *
     * Prefers governorate-level rows (`source_id = 4` or `note` mentioning
     * "governorate"), falling back to other `population` rows per governorate.
     *
     * @return array{
     *     source_id: int,
     *     note: ?string,
     *     date: ?string,
     *     source_url: ?string,
     *     total: int,
     *     governorates: list<array{id: string, name_ar: string, dataset_name_en: string, value: int, url: string}>
     * }|null
     */
    private function buildInitialSummary(): ?array
    {
        try {
            $rows = PopulationDemographic::query()
                ->where('data_type', 'population')
                ->get(['source_id', 'note', 'date', 'source_url', 'city_name', 'value']);
        } catch (\Throwable) {
            return null;
        }

        if ($rows->isEmpty()) {
            return null;
        }

        $preferred = [];
        $fallback = [];

        foreach ($rows as $row) {
            $gov = Facts::governorateByAnyName((string) $row->city_name);
            if ($gov === null || (int) $row->value <= 0) {
                continue;
            }

            $govId = (string) $gov['id'];
            $entry = [
                'source_id' => (int) $row->source_id,
                'value' => (int) $row->value,
                'date' => $row->date ? $row->date->format('Y-m-d') : null,
                'source_url' => filled($row->source_url) ? (string) $row->source_url : null,
                'note' => filled($row->note) ? (string) $row->note : null,
            ];

            $isGovernorateLevel = (int) $row->source_id === 4
                || stripos((string) $row->note, 'governorate') !== false;

            if ($isGovernorateLevel) {
                $preferred[$govId] = $entry;
            } elseif (! isset($fallback[$govId])) {
                $fallback[$govId] = $entry;
            }
        }

        $resolved = $preferred + $fallback;
        if ($resolved === []) {
            return null;
        }

        $metaEntry = reset($preferred) ?: reset($resolved);

        $ordered = Facts::governorates();
        usort($ordered, fn (array $a, array $b) => ((int) $a['sort_order']) <=> ((int) $b['sort_order']));

        $governorates = [];
        $total = 0;

        foreach ($ordered as $gov) {
            $id = (string) $gov['id'];
            $entry = $resolved[$id] ?? null;
            if ($entry === null) {
                continue;
            }

            $total += $entry['value'];

            $governorates[] = [
                'id' => $id,
                'name_ar' => (string) $gov['name_ar'],
                'dataset_name_en' => (string) $gov['dataset_name_en'],
                'value' => $entry['value'],
                'url' => '/governorates/'.$id,
            ];
        }

        if ($governorates === []) {
            return null;
        }

        return [
            'source_id' => $metaEntry['source_id'],
            'note' => $metaEntry['note'],
            'date' => $metaEntry['date'],
            'source_url' => $metaEntry['source_url'],
            'total' => $total,
            'governorates' => $governorates,
        ];
    }

    private function buildMasterData(): array
    {
        $demographics = PopulationDemographic::select('data_type', 'source_id', 'note', 'date', 'source_url', 'city_name', 'value')->get();
        $grouped = [];

        foreach ($demographics as $item) {
            $type = $item->data_type;
            $sourceId = $item->source_id;

            if (! isset($grouped[$type][$sourceId])) {
                $grouped[$type][$sourceId] = [
                    'source_id' => $sourceId,
                    'note' => $item->note,
                    'date' => $item->date ? $item->date->format('Y-m-d') : null,
                    'source_url' => $item->source_url,
                    'cities' => [],
                ];
            }

            $grouped[$type][$sourceId]['cities'][$item->city_name] = $item->value;
        }

        $formattedDemographics = [];
        foreach ($grouped as $type => $sources) {
            $formattedDemographics[$type] = array_values($sources);
        }

        $envLogs = PopulationEnvironmentalLog::pluck('city_name')->toArray();

        if (! empty($envLogs)) {
            $envCities = [];
            foreach ($envLogs as $city) {
                $envCities[$city] = 1;
            }

            $envAvailability = [
                [
                    'source_id' => 1,
                    'cities' => $envCities,
                ],
            ];

            if (! isset($formattedDemographics['environmental'])) {
                $formattedDemographics['environmental'] = $envAvailability;
            }
        }

        $rainfall = PopulationRainfall::select('pcode', 'year', 'rainfall', 'rainfall_avg')->orderBy('year')->get();
        $rainfallData = [];

        foreach ($rainfall as $item) {
            if (! isset($rainfallData[$item->pcode])) {
                $rainfallData[$item->pcode] = [];
            }

            $rainfallData[$item->pcode][] = [
                'year' => $item->year,
                'rainfall' => $item->rainfall,
                'rainfall_avg' => $item->rainfall_avg,
            ];
        }

        return [
            'groups' => $formattedDemographics,
            'rainfall_data' => $rainfallData,
        ];
    }

    private function buildEnvironmentalReport(): array
    {
        $envLogs = PopulationEnvironmentalLog::select('city_name', 'lat', 'lon', 'population_ref', 'current_conditions', 'forecast_summary', 'climate_trends', 'air_quality', 'drought_risk', 'historical_summary')->get();
        $citiesData = [];

        foreach ($envLogs as $log) {
            $citiesData[$log->city_name] = [
                'coordinates' => [
                    'latitude' => $log->lat,
                    'longitude' => $log->lon,
                ],
                'population' => $log->population_ref,
                'current_conditions' => $log->current_conditions,
                'daily_forecast_summary' => $log->forecast_summary,
                'climate_trends' => $log->climate_trends,
                'air_quality' => $log->air_quality,
                'drought_risk' => $log->drought_risk,
                'historical_summary' => $log->historical_summary,
            ];
        }

        $metadata = [
            'country' => 'Syria',
            'report_date' => now()->toIso8601String(),
            'data_sources' => ['Open-Meteo', 'NASA POWER', 'World Bank Climate API'],
            'cities_analyzed' => count($citiesData),
        ];

        $countryLevel = [
            'world_bank_climate_data' => [
                'status' => 'Data available via SyriaClimateService',
            ],
            'climate_context' => [
                'classification' => 'Mostly semi-arid to arid',
                'main_climate_challenges' => [
                    'Water scarcity and declining groundwater levels',
                    'Increasing drought frequency and severity',
                    'Rising temperatures and heat waves',
                    'Rainfall pattern changes affecting agriculture',
                    'Air quality concerns in urban areas',
                ],
                'key_water_basins' => [
                    'Euphrates River Basin',
                    'Orontes River Basin',
                    'Yarmouk River Basin',
                    'Barada and Awaj Basin',
                    'Coastal Basin',
                ],
            ],
        ];

        $droughtHighCount = collect($citiesData)
            ->pluck('drought_risk.drought_risk')
            ->filter(fn ($r) => in_array($r, ['High', 'Very High']))
            ->count();

        $aqiPoorCount = collect($citiesData)
            ->pluck('air_quality.estimated_aqi')
            ->filter(fn ($aqi) => $aqi > 75)
            ->count();

        $keyFindings = [
            "{$droughtHighCount}/".count($citiesData).' cities at high/very high drought risk',
            "{$aqiPoorCount}/".count($citiesData).' cities with poor air quality conditions',
            'Generated by Laravel Climate Service at '.now()->toDateTimeString(),
        ];

        $summary = [
            'total_cities_analyzed' => count($citiesData),
            'data_collection_date' => now()->toIso8601String(),
            'key_findings' => $keyFindings,
            'recommendations' => [
                'Implement water conservation and efficient irrigation systems',
                'Develop drought-resistant agricultural practices',
                'Monitor air quality in major urban centers',
                'Enhance early warning systems for extreme weather events',
                'Invest in renewable energy to reduce pollution',
            ],
        ];

        return [
            'metadata' => $metadata,
            'cities' => $citiesData,
            'country_level' => $countryLevel,
            'summary' => $summary,
        ];
    }
}
