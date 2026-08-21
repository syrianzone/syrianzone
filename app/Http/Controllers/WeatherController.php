<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class WeatherController extends Controller
{
  // Server-side proxy for the weather worker. The worker answers with a fixed
  // `access-control-allow-origin: https://syrian.zone`, so a browser call fails
  // everywhere except production: staging, local dev, and any preview URL all
  // get a CORS error. Fetching server-side has no CORS at all, and gives us the
  // caching the direct browser call never had.
  //
  // Coordinates are not accepted freely from the client: custom lat/lon is
  // clamped to Syria's bounding box and rounded, which bounds both the cache
  // key space and upstream API spend — without this the endpoint would be an
  // open weather proxy keyed on arbitrary attacker-chosen coordinates.
  private const BBOX = ['lat_min' => 32.0, 'lat_max' => 37.3, 'lon_min' => 35.6, 'lon_max' => 42.4];

  private const COORDS = [
    'damascus' => [33.5138, 36.2765],
    'rural-damascus' => [33.5138, 36.2765],
    'aleppo' => [36.2021, 37.1343],
    'homs' => [34.7324, 36.7137],
    'hama' => [35.1318, 36.7578],
    'latakia' => [35.5317, 35.7901],
    'tartus' => [34.8890, 35.8866],
    'deir-ez-zor' => [35.3359, 40.1408],
    'idlib' => [35.9306, 36.6339],
    'daraa' => [32.6255, 36.1016],
    'quneitra' => [33.1250, 35.8250],
    'sweida' => [32.7089, 36.5695],
    'hasakah' => [36.5023, 40.7382],
    'raqqa' => [35.9520, 39.0081],
  ];

  private const TTL = 600;

  // The forecast is a separate upstream with a much flatter curve: a daily
  // min/max does not meaningfully move every ten minutes, so it gets its own
  // key and its own ttl rather than being thrown away with the current reading.
  private const FORECAST_TTL = 3600;

  private const FORECAST_DAYS = 5;

  public function show(Request $request)
  {
    $governorate = $request->query('governorate');
    $lat = $request->query('lat');
    $lon = $request->query('lon');

    if ($governorate && isset(self::COORDS[$governorate])) {
      [$lat, $lon] = self::COORDS[$governorate];
      $cacheKey = "weather:{$governorate}";
    } elseif ($lat !== null && $lon !== null && is_numeric($lat) && is_numeric($lon)) {
      $lat = (float) $lat;
      $lon = (float) $lon;

      // Round before validation so nearby points collapse onto one cache key;
      // then reject anything outside the bounding box entirely.
      $lat = round($lat, 2);
      $lon = round($lon, 2);

      if (
        $lat < self::BBOX['lat_min'] || $lat > self::BBOX['lat_max']
        || $lon < self::BBOX['lon_min'] || $lon > self::BBOX['lon_max']
      ) {
        return response()->json(['message' => 'الإحداثيات خارج نطاق سوريا'], 422);
      }

      $governorate = $governorate ?: 'custom';
      $cacheKey = "weather:{$governorate}:{$lat}:{$lon}";
    } else {
      return response()->json(['message' => 'المحافظة مطلوبة أو إحداثيات صالحة'], 422);
    }

    $cached = Cache::get($cacheKey);
    if ($cached !== null) {
      return response()->json($cached)->header('Cache-Control', 'public, max-age=300');
    }

    try {
      $apiKey = config('services.openweather.key');
      $apiUrl = config('services.openweather.url', 'https://api.openweathermap.org/data/2.5/weather');

      $response = Http::timeout(5)->get($apiUrl, [
        'lat' => $lat,
        'lon' => $lon,
        'appid' => $apiKey,
        'units' => 'metric',
      ]);
    } catch (\Throwable $e) {
      return response()->json(['message' => 'تعذر تحميل الطقس'], 502);
    }

    if (! $response->successful()) {
      return response()->json(['message' => 'تعذر تحميل الطقس'], 502);
    }

    $temp = $response->json('main.temp');
    if ($temp === null) {
      return response()->json(['message' => 'تعذر تحميل الطقس'], 502);
    }

    $payload = [
      'governorate' => $governorate,
      'temp' => (int) round($temp),
      'description' => $response->json('weather.0.description') ?? '',
      'icon' => $response->json('weather.0.icon') ?? '',
      'main' => $response->json('main'),
      'weather' => $response->json('weather'),
      'forecast' => $this->forecast($governorate, (float) $lat, (float) $lon),
    ];

    Cache::put($cacheKey, $payload, self::TTL);

    return response()->json($payload)->header('Cache-Control', 'public, max-age=300');
  }

  // Open-Meteo, the same provider and url conventions SyriaClimateService
  // already uses here: free, no key, and the daily block is exactly the three
  // series the widget needs. Every failure path returns [] rather than throwing,
  // because this runs inside a request whose primary job is current conditions.
  //
  // The WMO code is passed through raw. The arabic labels live in the widget,
  // next to the arabic mapping it already owns for `description`, so display
  // vocabulary stays in one place instead of being split across the boundary.
  private function forecast(string $governorate, float $lat, float $lon): array
  {
    $key = "weather:forecast:{$governorate}";
    $cached = Cache::get($key);
    if ($cached !== null) {
      return $cached;
    }

    try {
      $response = Http::timeout(5)->get('https://api.open-meteo.com/v1/forecast', [
        'latitude' => $lat,
        'longitude' => $lon,
        'daily' => 'temperature_2m_max,temperature_2m_min,weather_code',
        'timezone' => 'auto',
        'forecast_days' => self::FORECAST_DAYS,
      ]);
    } catch (\Throwable $e) {
      return [];
    }

    if (! $response->successful()) {
      return [];
    }

    $daily = $response->json('daily');
    if (! is_array($daily) || ! is_array($daily['time'] ?? null)) {
      return [];
    }

    $days = [];
    foreach ($daily['time'] as $i => $date) {
      $min = $daily['temperature_2m_min'][$i] ?? null;
      $max = $daily['temperature_2m_max'][$i] ?? null;
      if ($min === null || $max === null) {
        continue;
      }

      $days[] = [
        'date' => (string) $date,
        'min' => (int) round($min),
        'max' => (int) round($max),
        'code' => (int) ($daily['weather_code'][$i] ?? 0),
      ];
    }

    if ($days === []) {
      // not cached: a malformed answer must not stick for the whole ttl
      return [];
    }

    Cache::put($key, $days, self::FORECAST_TTL);

    return $days;
  }
}
