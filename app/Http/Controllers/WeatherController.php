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
  // Coordinates are not accepted from the client: keying on a fixed governorate
  // list bounds the cache and stops this becoming an open weather proxy.
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

  public function show(Request $request)
  {
    $validated = $request->validate([
      'governorate' => 'required|string|in:'.implode(',', array_keys(self::COORDS)),
    ], [
      'governorate.required' => 'المحافظة مطلوبة',
      'governorate.in' => 'محافظة غير معروفة',
    ]);

    $governorate = $validated['governorate'];
    $cached = Cache::get("weather:{$governorate}");
    if ($cached !== null) {
      return response()->json($cached)->header('Cache-Control', 'public, max-age=300');
    }

    [$lat, $lon] = self::COORDS[$governorate];

    try {
      $response = Http::timeout(5)->get(config('services.weather.url'), ['lat' => $lat, 'lon' => $lon]);
    } catch (\Throwable $e) {
      return response()->json(['message' => 'تعذر تحميل الطقس'], 502);
    }

    if (! $response->successful()) {
      // not cached: a transient upstream error must not stick for the whole ttl
      return response()->json(['message' => 'تعذر تحميل الطقس'], 502);
    }

    $temp = $response->json('main.temp');
    if ($temp === null) {
      return response()->json(['message' => 'تعذر تحميل الطقس'], 502);
    }

    $payload = [
      'governorate' => $governorate,
      'temp' => (int) round($temp),
      // english, as the upstream sends it; the widget owns the arabic mapping
      'description' => $response->json('weather.0.description') ?? '',
      'icon' => $response->json('weather.0.icon') ?? '',
    ];

    Cache::put("weather:{$governorate}", $payload, self::TTL);

    return response()->json($payload)->header('Cache-Control', 'public, max-age=300');
  }
}
