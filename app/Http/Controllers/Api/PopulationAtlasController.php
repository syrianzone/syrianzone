<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Population\PopulationDemographic;
use App\Models\Population\PopulationEnvironmentalLog;
use App\Models\Population\PopulationRainfall;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class PopulationAtlasController extends Controller
{
    public function getData(): JsonResponse
    {
        $data = Cache::remember('population_master_v2', 3600, function () {
            return $this->buildMasterData();
        });

        return response()->json($data);
    }

    public function getEnvironmentalDetails(): JsonResponse
    {
        $data = Cache::remember('population_env_report_v2', 3600, function () {
            return $this->buildEnvironmentalReport();
        });

        return response()->json($data);
    }

    public function renderIndex()
    {
        $masterData = Cache::remember('population_master_v2', 3600, function () {
            return $this->buildMasterData();
        });

        $envData = Cache::remember('population_env_report_v2', 3600, function () {
            return $this->buildEnvironmentalReport();
        });

        return Inertia::render('Population/Index', [
            'masterData' => $masterData,
            'envData' => $envData,
        ]);
    }

    private function buildMasterData(): array
    {
        $demographics = PopulationDemographic::all();
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

        $formattedDemographics = [
            'population' => [],
            'idp' => [],
            'idp_returnees' => [],
            'rainfall' => [],
            'environmental' => [],
        ];
        foreach ($grouped as $type => $sources) {
            if (! array_key_exists($type, $formattedDemographics)) {
                continue;
            }
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
                    'source_url' => null,
                    'date' => null,
                    'note' => null,
                    'cities' => $envCities,
                ],
            ];

            if (empty($formattedDemographics['environmental'])) {
                $formattedDemographics['environmental'] = $envAvailability;
            }
        }

        $rainfall = PopulationRainfall::all();
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
            'rainfall_data' => (object) $rainfallData,
        ];
    }

    private function buildEnvironmentalReport(): array
    {
        $envLogs = PopulationEnvironmentalLog::all();
        $citiesData = [];

        foreach ($envLogs as $log) {
            $citiesData[$log->city_name] = [
                'coordinates' => [
                    'latitude' => $log->lat,
                    'longitude' => $log->lon,
                ],
                'population' => $log->population_ref,
                'current_conditions' => (object) ($log->current_conditions ?? []),
                'daily_forecast_summary' => (object) ($log->forecast_summary ?? []),
                'climate_trends' => (object) ($log->climate_trends ?? []),
                'air_quality' => (object) ($log->air_quality ?? []),
                'drought_risk' => (object) ($log->drought_risk ?? []),
                'historical_summary' => (object) ($log->historical_summary ?? []),
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
            'cities' => (object) $citiesData,
            'country_level' => $countryLevel,
            'summary' => $summary,
        ];
    }
}
