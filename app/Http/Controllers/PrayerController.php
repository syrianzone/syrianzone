<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class PrayerController extends Controller
{
  // Server-side proxy for the aladhan timings API, mirroring WeatherController.
  // The widget used to call aladhan straight from the browser, which only works
  // because that host happens to send a permissive CORS header today. The
  // weather worker taught us what happens when a third party's CORS policy is
  // load-bearing: it broke on staging and on localhost. Fetching server-side has
  // no CORS at all and gives us caching the direct call never had.
  //
  // Same fixed governorate list as WeatherController::COORDS: coordinates are
  // never accepted from the client, so this cannot become an open proxy and the
  // cache stays bounded.
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

  // Only the six the widget renders. Aladhan also returns Imsak, Midnight and
  // the night thirds, which nothing on the board uses.
  private const PRAYERS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  // Timings are for a calendar day in Syria, so the day boundary that matters is
  // Damascus midnight, not the app timezone or the visitor's clock.
  private const TZ = 'Asia/Damascus';

  public function show(Request $request)
  {
    $validated = $request->validate([
      'governorate' => 'required|string|in:'.implode(',', array_keys(self::COORDS)),
    ], [
      'governorate.required' => 'المحافظة مطلوبة',
      'governorate.in' => 'محافظة غير معروفة',
    ]);

    $governorate = $validated['governorate'];
    $today = now()->timezone(self::TZ);

    // the date is part of the key, so the entry rolls over at Damascus midnight
    // on its own instead of relying on a ttl landing on the boundary
    $key = "prayer:{$governorate}:{$today->format('Y-m-d')}";
    $cached = Cache::get($key);
    if ($cached !== null) {
      return response()->json($cached)->header('Cache-Control', 'public, max-age=300');
    }

    [$lat, $lon] = self::COORDS[$governorate];

    try {
      $response = Http::timeout(5)->get(rtrim(config('services.prayer.url'), '/').'/'.$today->format('d-m-Y'), [
        'latitude' => $lat,
        'longitude' => $lon,
        // method 3 is the Muslim World League calculation, the Syrian standard
        'method' => 3,
      ]);
    } catch (\Throwable $e) {
      return response()->json(['message' => 'تعذر تحميل المواقيت'], 502);
    }

    if (! $response->successful() || $response->json('code') !== 200) {
      // not cached: a transient upstream error must not stick for the whole day
      return response()->json(['message' => 'تعذر تحميل المواقيت'], 502);
    }

    $timings = $response->json('data.timings');
    if (! is_array($timings)) {
      return response()->json(['message' => 'تعذر تحميل المواقيت'], 502);
    }

    $normalized = [];
    foreach (self::PRAYERS as $prayer) {
      if (isset($timings[$prayer])) {
        // upstream sends "04:00" or "04:00 (EEST)"; the widget wants bare HH:MM
        $normalized[$prayer] = substr($timings[$prayer], 0, 5);
      }
    }

    if ($normalized === []) {
      return response()->json(['message' => 'تعذر تحميل المواقيت'], 502);
    }

    $payload = [
      'governorate' => $governorate,
      'timings' => $normalized,
      'hijri' => $this->hijri($response->json('data.date.hijri')),
    ];

    // expire with the day too, so a stale entry cannot outlive its key
    Cache::put($key, $payload, $today->copy()->endOfDay()->timestamp - $today->timestamp + 1);

    return response()->json($payload)->header('Cache-Control', 'public, max-age=300');
  }

  // Aladhan already computes the Hijri date (Umm al-Qura basis) alongside the
  // timings, so we pass it through rather than adding a conversion library.
  // Null when upstream omits it: the widget drops the line, it is not fatal.
  private function hijri(mixed $hijri): ?array
  {
    if (! is_array($hijri) || ! isset($hijri['day'], $hijri['year']) || ! isset($hijri['month']['ar'])) {
      return null;
    }

    return [
      'day' => (string) $hijri['day'],
      'month' => (string) $hijri['month']['ar'],
      'year' => (string) $hijri['year'],
    ];
  }
}
