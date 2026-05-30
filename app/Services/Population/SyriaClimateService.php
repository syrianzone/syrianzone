<?php

namespace App\Services\Population;

use App\Models\Population\PopulationEnvironmentalLog;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Console\Helper\ProgressBar;
use Symfony\Component\Console\Output\OutputInterface;

class SyriaClimateService
{
    private ?OutputInterface $output = null;
    private ?ProgressBar $progressBar = null;

    private const WEATHER_CODES = [
        0 => 'Clear sky',
        1 => 'Mainly clear',
        2 => 'Partly cloudy',
        3 => 'Overcast',
        45 => 'Fog',
        48 => 'Depositing rime fog',
        51 => 'Light drizzle',
        53 => 'Moderate drizzle',
        55 => 'Dense drizzle',
        61 => 'Slight rain',
        63 => 'Moderate rain',
        65 => 'Heavy rain',
        71 => 'Slight snow fall',
        73 => 'Moderate snow fall',
        75 => 'Heavy snow fall',
        80 => 'Slight rain showers',
        81 => 'Moderate rain showers',
        82 => 'Violent rain showers',
        95 => 'Thunderstorm',
        96 => 'Thunderstorm with slight hail',
        99 => 'Thunderstorm with heavy hail',
    ];

    public function setOutput(OutputInterface $output): self
    {
        $this->output = $output;
        return $this;
    }

    public function updateAllCities(): void
    {
        $cities = PopulationEnvironmentalLog::all();
        $totalCities = $cities->count();

        if ($totalCities === 0) {
            Log::warning('No cities found in pop_environmental_log table');
            return;
        }

        $processed = 0;

        foreach ($cities as $city) {
            try {
                $this->processCity($city);
                usleep(500000);

                if ($this->output) {
                    $processed++;
                    $this->output->writeln("✓ Processed {$processed}/{$totalCities}: {$city->city_name}");
                }
            } catch (\Exception $e) {
                Log::error("Failed to process city {$city->city_name}: " . $e->getMessage(), [
                    'exception' => $e,
                    'city_id' => $city->id,
                ]);

                if ($this->output) {
                    $processed++;
                    $this->output->writeln("✗ Failed {$processed}/{$totalCities}: {$city->city_name}");
                }
            }
        }
    }

    public function processCity(PopulationEnvironmentalLog $city): void
    {
        $currentWeather = $this->fetchCurrentWeather($city->lat, $city->lon);

        if (empty($currentWeather)) {
            Log::warning("No current weather data retrieved for {$city->city_name}");
        }

        usleep(500000);

        $historicalWeather = $this->fetchHistoricalWeather($city->lat, $city->lon, 5);

        if (empty($historicalWeather)) {
            Log::warning("No historical weather data retrieved for {$city->city_name}");
        }

        usleep(500000);

        $city->current_conditions = $this->buildCurrentConditions($currentWeather);
        $city->forecast_summary = $this->buildForecastSummary($currentWeather);
        $city->climate_trends = $this->calculateClimateTrends($historicalWeather);
        $city->air_quality = $this->estimateAirQuality($currentWeather);
        $city->drought_risk = $this->analyzeDroughtRisk($historicalWeather);
        $city->historical_summary = $this->buildHistoricalSummary($historicalWeather);
        $city->last_updated_at = now();

        $city->save();

        Log::info("Successfully updated environmental data for {$city->city_name}");
    }

    private function fetchCurrentWeather(float $lat, float $lon): array
    {
        try {
            $response = Http::timeout(30)->get('https://api.open-meteo.com/v1/forecast', [
                'latitude' => $lat,
                'longitude' => $lon,
                'current' => 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
                'daily' => 'temperature_2m_max,temperature_2m_min,temperature_2m_mean,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,daylight_duration,sunshine_duration,precipitation_sum,rain_sum,precipitation_hours,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant',
                'timezone' => 'auto',
            ]);

            if ($response->successful()) {
                return $response->json();
            }

            Log::error("Open-Meteo current weather API failed", [
                'status' => $response->status(),
                'body' => $response->body(),
                'lat' => $lat,
                'lon' => $lon,
            ]);

            return [];
        } catch (\Exception $e) {
            Log::error("Exception fetching current weather", [
                'exception' => $e,
                'lat' => $lat,
                'lon' => $lon,
            ]);
            return [];
        }
    }

    private function fetchHistoricalWeather(float $lat, float $lon, int $years = 5): array
    {
        try {
            $endDate = now()->subDays(2);
            $startDate = $endDate->subYears($years);

            $response = Http::timeout(60)->get('https://archive-api.open-meteo.com/v1/archive', [
                'latitude' => $lat,
                'longitude' => $lon,
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => $endDate->format('Y-m-d'),
                'daily' => 'temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max,et0_fao_evapotranspiration,surface_pressure_mean',
                'timezone' => 'auto',
            ]);

            if ($response->successful()) {
                return $response->json();
            }

            Log::error("Open-Meteo historical weather API failed", [
                'status' => $response->status(),
                'body' => $response->body(),
                'lat' => $lat,
                'lon' => $lon,
            ]);

            return [];
        } catch (\Exception $e) {
            Log::error("Exception fetching historical weather", [
                'exception' => $e,
                'lat' => $lat,
                'lon' => $lon,
            ]);
            return [];
        }
    }

    private function calculateClimateTrends(array $historicalData): array
    {
        $trends = [];

        if (empty($historicalData) || !isset($historicalData['daily'])) {
            return $trends;
        }

        $daily = $historicalData['daily'];

        if (!isset($daily['time']) || !isset($daily['temperature_2m_mean'])) {
            return $trends;
        }

        $yearlyData = [];

        foreach ($daily['time'] as $index => $dateString) {
            $date = Carbon::parse($dateString);
            $year = $date->year;

            if (!isset($yearlyData[$year])) {
                $yearlyData[$year] = [
                    'temp_sum' => 0,
                    'temp_count' => 0,
                    'precip_sum' => 0,
                ];
            }

            if (isset($daily['temperature_2m_mean'][$index])) {
                $yearlyData[$year]['temp_sum'] += $daily['temperature_2m_mean'][$index];
                $yearlyData[$year]['temp_count']++;
            }

            if (isset($daily['precipitation_sum'][$index])) {
                $yearlyData[$year]['precip_sum'] += $daily['precipitation_sum'][$index];
            }
        }

        ksort($yearlyData);
        $years = array_keys($yearlyData);

        if (count($years) < 2) {
            return $trends;
        }

        $firstYear = $years[0];
        $lastYear = $years[count($years) - 1];

        $firstYearAvgTemp = $yearlyData[$firstYear]['temp_sum'] / $yearlyData[$firstYear]['temp_count'];
        $lastYearAvgTemp = $yearlyData[$lastYear]['temp_sum'] / $yearlyData[$lastYear]['temp_count'];

        $tempChange = $lastYearAvgTemp - $firstYearAvgTemp;
        $trends['temperature_trend_celsius'] = round($tempChange, 2);
        $trends['temperature_change_rate_per_year'] = round($tempChange / (count($years) - 1), 3);

        $firstYearPrecip = $yearlyData[$firstYear]['precip_sum'];
        $lastYearPrecip = $yearlyData[$lastYear]['precip_sum'];

        $rainfallChange = $lastYearPrecip - $firstYearPrecip;
        $trends['rainfall_trend_mm'] = round($rainfallChange, 2);

        $totalPrecipitation = array_sum(array_column($yearlyData, 'precip_sum'));
        $trends['average_annual_rainfall_mm'] = round($totalPrecipitation / count($yearlyData), 2);

        if (isset($daily['surface_pressure_mean'])) {
            $avgPressure = array_sum($daily['surface_pressure_mean']) / count($daily['surface_pressure_mean']);
            $trends['avg_surface_pressure_hpa'] = round($avgPressure, 1);
        }

        return $trends;
    }

    private function estimateAirQuality(array $weatherData): array
    {
        $aqiData = [
            'estimated' => true,
            'method' => 'Weather-based estimation',
            'factors' => [],
        ];

        $current = $weatherData['current'] ?? [];

        $aqiData['factors']['wind_speed_m_s'] = $current['wind_speed_10m'] ?? 0;
        $aqiData['factors']['humidity_percent'] = $current['relative_humidity_2m'] ?? 0;
        $aqiData['factors']['cloud_cover_percent'] = $current['cloud_cover'] ?? 0;
        $aqiData['factors']['pressure_msl_hpa'] = $current['pressure_msl'] ?? 1013;

        $windSpeed = $current['wind_speed_10m'] ?? 0;

        if ($windSpeed < 5) {
            $aqiCategory = 'Poor (Low dispersion)';
            $aqiScore = 100;
        } elseif ($windSpeed < 10) {
            $aqiCategory = 'Moderate';
            $aqiScore = 70;
        } else {
            $aqiCategory = 'Good (Good dispersion)';
            $aqiScore = 40;
        }

        $aqiData['estimated_aqi'] = $aqiScore;
        $aqiData['category'] = $aqiCategory;
        $aqiData['health_recommendation'] = $this->getHealthRecommendation($aqiScore);

        return $aqiData;
    }

    private function getHealthRecommendation(int $aqiScore): string
    {
        if ($aqiScore <= 50) {
            return 'Air quality is good. Outdoor activities are safe.';
        } elseif ($aqiScore <= 75) {
            return 'Moderate air quality. Sensitive individuals should limit prolonged outdoor exertion.';
        } else {
            return 'Poor air quality. Everyone should limit prolonged outdoor exertion.';
        }
    }

    private function analyzeDroughtRisk(array $precipitationData): array
    {
        $droughtAnalysis = [];

        if (empty($precipitationData) || !isset($precipitationData['daily'])) {
            return $droughtAnalysis;
        }

        $daily = $precipitationData['daily'];

        if (!isset($daily['time']) || !isset($daily['precipitation_sum'])) {
            return $droughtAnalysis;
        }

        $monthlyRainfall = [];

        foreach ($daily['time'] as $index => $dateString) {
            $date = Carbon::parse($dateString);
            $month = $date->month;

            if (!isset($monthlyRainfall[$month])) {
                $monthlyRainfall[$month] = [];
            }

            if (isset($daily['precipitation_sum'][$index])) {
                $monthlyRainfall[$month][] = $daily['precipitation_sum'][$index];
            }
        }

        $monthlyAverages = [];
        foreach ($monthlyRainfall as $month => $values) {
            if (!empty($values)) {
                $monthlyAverages[$month] = array_sum($values) / count($values);
            }
        }

        $drySeasonMonths = [];
        $wetSeasonMonths = [];

        foreach ($monthlyAverages as $month => $avg) {
            if ($avg < 20) {
                $drySeasonMonths[] = $month;
            } else {
                $wetSeasonMonths[] = $month;
            }
        }

        $droughtAnalysis['dry_season_months'] = $drySeasonMonths;
        $droughtAnalysis['wet_season_months'] = $wetSeasonMonths;

        $annualPrecipitation = array_sum($monthlyAverages) * 30.44;
        $droughtAnalysis['annual_precipitation_mm'] = round($annualPrecipitation, 2);

        if ($droughtAnalysis['annual_precipitation_mm'] < 300) {
            $droughtAnalysis['drought_risk'] = 'Very High';
            $droughtAnalysis['classification'] = 'Arid/Semi-arid';
        } elseif ($droughtAnalysis['annual_precipitation_mm'] < 600) {
            $droughtAnalysis['drought_risk'] = 'High';
            $droughtAnalysis['classification'] = 'Semi-arid';
        } else {
            $droughtAnalysis['drought_risk'] = 'Moderate';
            $droughtAnalysis['classification'] = 'Sub-humid';
        }

        return $droughtAnalysis;
    }

    private function buildCurrentConditions(array $weatherData): array
    {
        $conditions = [];

        if (empty($weatherData) || !isset($weatherData['current'])) {
            return $conditions;
        }

        $current = $weatherData['current'];

        $conditions['temperature_celsius'] = $current['temperature_2m'] ?? null;
        $conditions['feels_like_celsius'] = $current['apparent_temperature'] ?? null;
        $conditions['humidity_percent'] = $current['relative_humidity_2m'] ?? null;
        $conditions['precipitation_mm'] = $current['precipitation'] ?? 0;
        $conditions['wind_speed_kmh'] = $current['wind_speed_10m'] ?? 0;
        $conditions['wind_direction_degrees'] = $current['wind_direction_10m'] ?? null;
        $conditions['pressure_msl_hpa'] = $current['pressure_msl'] ?? null;
        $conditions['pressure_surface_hpa'] = $current['surface_pressure'] ?? null;
        $conditions['cloud_cover_percent'] = $current['cloud_cover'] ?? null;

        $weatherCode = $current['weather_code'] ?? 0;
        $conditions['weather_description'] = $this->getWeatherDescription($weatherCode);

        return $conditions;
    }

    private function buildForecastSummary(array $weatherData): array
    {
        $summary = [];

        if (empty($weatherData) || !isset($weatherData['daily'])) {
            return $summary;
        }

        $daily = $weatherData['daily'];

        if (isset($daily['temperature_2m_max']) && count($daily['temperature_2m_max']) > 1) {
            $summary['tomorrow_max_temp_c'] = $daily['temperature_2m_max'][1] ?? null;
        }

        if (isset($daily['temperature_2m_min']) && count($daily['temperature_2m_min']) > 1) {
            $summary['tomorrow_min_temp_c'] = $daily['temperature_2m_min'][1] ?? null;
        }

        if (isset($daily['precipitation_sum']) && count($daily['precipitation_sum']) > 1) {
            $summary['tomorrow_precipitation_mm'] = $daily['precipitation_sum'][1] ?? null;
        }

        return $summary;
    }

    private function buildHistoricalSummary(array $historicalData): array
    {
        $summary = [];

        if (empty($historicalData) || !isset($historicalData['daily'])) {
            return $summary;
        }

        $daily = $historicalData['daily'];

        if (isset($daily['time'])) {
            $summary['period_start'] = $daily['time'][0] ?? null;
            $summary['period_end'] = $daily['time'][count($daily['time']) - 1] ?? null;
        }

        if (isset($daily['temperature_2m_max'])) {
            $summary['avg_max_temp_c'] = round(array_sum($daily['temperature_2m_max']) / count($daily['temperature_2m_max']), 2);
        }

        if (isset($daily['temperature_2m_min'])) {
            $summary['avg_min_temp_c'] = round(array_sum($daily['temperature_2m_min']) / count($daily['temperature_2m_min']), 2);
        }

        if (isset($daily['precipitation_sum'])) {
            $summary['total_precipitation_mm'] = round(array_sum($daily['precipitation_sum']), 2);
        }

        if (isset($daily['wind_speed_10m_max'])) {
            $summary['max_wind_speed_kmh'] = round(max($daily['wind_speed_10m_max']), 2);
        }

        if (isset($daily['surface_pressure_mean'])) {
            $summary['avg_surface_pressure_hpa'] = round(array_sum($daily['surface_pressure_mean']) / count($daily['surface_pressure_mean']), 2);
        }

        return $summary;
    }

    private function getWeatherDescription(int $code): string
    {
        return self::WEATHER_CODES[$code] ?? "Unknown (code: {$code})";
    }
}
