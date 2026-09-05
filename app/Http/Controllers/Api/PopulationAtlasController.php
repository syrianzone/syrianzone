<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Population\PopulationDemographic;
use App\Models\Population\PopulationRainfall;
use App\Models\Population\PopulationEnvironmentalLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class PopulationAtlasController extends Controller
{
    public const MASTER_CACHE_KEY = 'population_master';
    public const ENV_CACHE_KEY = 'population_env_report';

    public static function flushCache(): void
    {
        Cache::forget(self::MASTER_CACHE_KEY);
        Cache::forget(self::ENV_CACHE_KEY);
    }

    public function getData(): JsonResponse
    {
        $data = Cache::remember(self::MASTER_CACHE_KEY, 3600, function () {
            return $this->buildMasterData();
        });

        return response()->json($data);
    }

    public function getEnvironmentalDetails(): JsonResponse
    {
        $data = Cache::remember(self::ENV_CACHE_KEY, 3600, function () {
            return $this->buildEnvironmentalReport();
        });

        return response()->json($data);
    }

    public function renderIndex()
    {
        // Shell only: the full atlas (demographics + all rainfall years +
        // city JSON snapshots) is multi-hundred-KB. Shipping it in Inertia
        // props blocks first paint on mobile; the client fetches via /api
        // with loading + retry states instead.
        return \Inertia\Inertia::render('Population/Index');
    }

    private function buildMasterData(): array
    {
        $demographics = PopulationDemographic::select('data_type', 'source_id', 'note', 'date', 'source_url', 'city_name', 'value')->get();
        $grouped = [];

        foreach ($demographics as $item) {
            $type = $item->data_type;
            $sourceId = $item->source_id;

            if (!isset($grouped[$type][$sourceId])) {
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

        if (!empty($envLogs)) {
            $envCities = [];
            foreach ($envLogs as $city) {
                $envCities[$city] = 1;
            }

            $envAvailability = [
                [
                    'source_id' => 1,
                    'cities' => $envCities,
                ]
            ];

            if (!isset($formattedDemographics['environmental'])) {
                $formattedDemographics['environmental'] = $envAvailability;
            }
        }

        $rainfall = PopulationRainfall::select('pcode', 'year', 'rainfall', 'rainfall_avg')->orderBy('year')->get();
        $rainfallData = [];

        foreach ($rainfall as $item) {
            if (!isset($rainfallData[$item->pcode])) {
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
            ->filter(fn($r) => in_array($r, ['High', 'Very High']))
            ->count();

        $aqiPoorCount = collect($citiesData)
            ->pluck('air_quality.estimated_aqi')
            ->filter(fn($aqi) => $aqi > 75)
            ->count();

        $keyFindings = [
            "{$droughtHighCount}/" . count($citiesData) . " cities at high/very high drought risk",
            "{$aqiPoorCount}/" . count($citiesData) . " cities with poor air quality conditions",
            "Generated by Laravel Climate Service at " . now()->toDateTimeString(),
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
