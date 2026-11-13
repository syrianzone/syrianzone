<?php

namespace App\Http\Controllers;

use App\Support\Facts;
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
  // Only a fixed governorate list is served: coordinates are never accepted
  // from the client, so this cannot become an open proxy and the cache stays
  // bounded. The list and its centres are the shared table in
  // resources/data/governorates.json, which WeatherController reads too.

  // AlAdhan calculation methods. The table is resources/data/prayer.json, which
  // Domain/prayer/methods.ts reads too: `methods` is what the pickers offer, and
  // `unlisted_method_ids` are ids the endpoint has always accepted (a client
  // that stored one keeps it instead of being silently reset). 3 (Muslim World
  // League, Fajr 18° / Isha 17°) is the Syrian standard and the default. The
  // method is a fiqh choice, never a coder default: the /muslim route exposes
  // this list to the user instead of hardcoding a silent HighLatitudeRule (see
  // Itqan #720).

  // Only the six the widgets render. Aladhan also returns Imsak, Midnight and
  // the night thirds, which nothing on the board uses.
  private const PRAYERS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  /**
   * Every calculation method id the endpoint accepts.
   *
   * @return array<int, int>
   */
  public static function methods(): array
  {
    return Facts::prayerMethodIds();
  }

  public static function defaultMethod(): int
  {
    return (int) Facts::prayer()['default_method'];
  }

  /**
   * The governorate ids the endpoint accepts.
   *
   * @return array<int, string>
   */
  private static function governorateIds(): array
  {
    return array_column(Facts::governorates(), 'id');
  }

  /**
   * @return array{0: float, 1: float}
   */
  private static function coordsFor(string $governorate): array
  {
    $row = Facts::governorate($governorate);
    if ($row === null) {
      throw new \InvalidArgumentException("Unknown governorate: {$governorate}");
    }

    return [(float) $row['lat'], (float) $row['lng']];
  }

  // Timings are for a calendar day in Syria, so the day boundary that matters is
  // Damascus midnight, not the app timezone or the visitor's clock.
  private static function timezone(): string
  {
    return Facts::syria()['timezone'];
  }

  public function show(Request $request)
  {
    $validated = $request->validate([
      'governorate' => 'nullable|string|in:'.implode(',', self::governorateIds()),
      'latitude' => 'nullable|numeric|between:-90,90',
      'longitude' => 'nullable|numeric|between:-180,180',
      'method' => 'nullable|integer|in:'.implode(',', self::methods()),
    ], [
      'governorate.in' => 'محافظة غير معروفة',
      'method.in' => 'طريقة حساب غير معروفة',
    ]);

    $method = (int) ($validated['method'] ?? self::defaultMethod());
    $today = now()->timezone(self::timezone());

    // Custom coordinates (diaspora / custom city): unlike weather, prayer is
    // deliberately NOT clamped to the Syria bbox — the user may be anywhere.
    // Rounded to 2 decimals before keying so nearby points share one cache
    // entry and the key space stays bounded (no open-proxy cache blowup).
    if (isset($validated['latitude'], $validated['longitude'])) {
      $lat = round((float) $validated['latitude'], 2);
      $lon = round((float) $validated['longitude'], 2);
      $governorate = 'custom';
      $key = "prayer:custom:{$lat}:{$lon}:{$method}:{$today->format('Y-m-d')}";
    } else {
      if (empty($validated['governorate'])) {
        return response()->json(['message' => 'المحافظة مطلوبة أو إحداثيات صالحة'], 422);
      }
      $governorate = $validated['governorate'];
      // the date is part of the key, so the entry rolls over at Damascus midnight
      // on its own instead of relying on a ttl landing on the boundary
      $key = "prayer:{$governorate}:{$method}:{$today->format('Y-m-d')}";
      [$lat, $lon] = self::coordsFor($governorate);
    }

    $cached = Cache::get($key);
    if ($cached !== null) {
      return response()->json($cached)->header('Cache-Control', 'public, max-age=300');
    }

    try {
      $response = Http::timeout(5)->get(rtrim(config('services.prayer.url'), '/').'/'.$today->format('d-m-Y'), [
        'latitude' => $lat,
        'longitude' => $lon,
        'method' => $method,
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
      'latitude' => $lat,
      'longitude' => $lon,
      'method' => $method,
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
