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

  private const KAABA_LAT = 21.4225;

  private const KAABA_LNG = 39.8262;

  private const SYRIAN_MONTHS_AR = [
    1 => 'كانون الثاني',
    2 => 'شباط',
    3 => 'آذار',
    4 => 'نيسان',
    5 => 'أيار',
    6 => 'حزيران',
    7 => 'تموز',
    8 => 'آب',
    9 => 'أيلول',
    10 => 'تشرين الأول',
    11 => 'تشرين الثاني',
    12 => 'كانون الأول',
  ];

  private const WEEKDAYS_AR = [
    0 => 'الأحد',
    1 => 'الاثنين',
    2 => 'الثلاثاء',
    3 => 'الأربعاء',
    4 => 'الخميس',
    5 => 'الجمعة',
    6 => 'السبت',
  ];

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

  /**
   * Remember an upstream failure for ten minutes and report no data.
   */
  private static function markFailed(string $key): null
  {
    Cache::put("{$key}:failed", true, now()->addMinutes(10));

    return null;
  }

  /**
   * Cached daily prayer timings for one Syrian governorate (used by both the
   * JSON API and server-rendered /muslim/prayer/{city} pages). Returns null on
   * transient upstream failure so SSR pages still render gracefully.
   *
   * @return array{governorate:string,latitude:float,longitude:float,method:int,timings:array<string,string>,hijri:?array{day:string,month:string,year:string}}|null
   */
  public static function timingsForGovernorate(string $governorate, ?int $method = null): ?array
  {
    if (! in_array($governorate, self::governorateIds(), true)) {
      return null;
    }

    $resolvedMethod = $method ?? self::defaultMethod();
    $today = now()->timezone(self::timezone());
    $key = "prayer:{$governorate}:{$resolvedMethod}:{$today->format('Y-m-d')}";

    $cached = Cache::get($key);
    if (is_array($cached)) {
      return $cached;
    }

    // A recent failure is remembered briefly so an upstream outage does not
    // make every page view wait for the timeout again.
    if (Cache::has("{$key}:failed")) {
      return null;
    }

    [$lat, $lon] = self::coordsFor($governorate);

    try {
      $response = Http::timeout(5)->get(rtrim((string) config('services.prayer.url'), '/').'/'.$today->format('d-m-Y'), [
        'latitude' => $lat,
        'longitude' => $lon,
        'method' => $resolvedMethod,
      ]);
    } catch (\Throwable) {
      return self::markFailed($key);
    }

    if (! $response->successful() || $response->json('code') !== 200) {
      return self::markFailed($key);
    }

    $timings = $response->json('data.timings');
    if (! is_array($timings)) {
      return self::markFailed($key);
    }

    $normalized = [];
    foreach (self::PRAYERS as $prayer) {
      if (isset($timings[$prayer])) {
        $normalized[$prayer] = substr((string) $timings[$prayer], 0, 5);
      }
    }

    if ($normalized === []) {
      return self::markFailed($key);
    }

    $payload = [
      'governorate' => $governorate,
      'latitude' => $lat,
      'longitude' => $lon,
      'method' => $resolvedMethod,
      'timings' => $normalized,
      'hijri' => self::parseHijri($response->json('data.date.hijri')),
    ];

    Cache::put($key, $payload, $today->copy()->endOfDay()->timestamp - $today->timestamp + 1);

    return $payload;
  }

  /**
   * Cached monthly prayer timetable for the current Gregorian month in Syria
   * time. Returns null on upstream failure so pages degrade gracefully to today.
   *
   * @return array{
   *     year: int,
   *     month: int,
   *     month_ar: string,
   *     days: array<int, array{
   *         date: string,
   *         gregorian_day: int,
   *         weekday_ar: string,
   *         hijri_day: string,
   *         hijri_month: string,
   *         hijri_year: string,
   *         timings: array<string, string>
   *     }>
   * }|null
   */
  public static function monthlyCalendarForGovernorate(string $governorate, ?int $method = null): ?array
  {
    if (! in_array($governorate, self::governorateIds(), true)) {
      return null;
    }

    $resolvedMethod = $method ?? self::defaultMethod();
    $today = now()->timezone(self::timezone());
    $year = (int) $today->format('Y');
    $month = (int) $today->format('n');
    $key = "prayer:calendar:{$governorate}:{$resolvedMethod}:{$today->format('Y-m')}";

    $cached = Cache::get($key);
    if (is_array($cached)) {
      return $cached;
    }

    // A recent failure is remembered briefly so an upstream outage does not
    // make every page view wait for the timeout again.
    if (Cache::has("{$key}:failed")) {
      return null;
    }

    [$lat, $lon] = self::coordsFor($governorate);

    try {
      $response = Http::timeout(6)->get(self::calendarBaseUrl()."/calendar/{$year}/{$month}", [
        'latitude' => $lat,
        'longitude' => $lon,
        'method' => $resolvedMethod,
      ]);
    } catch (\Throwable) {
      return self::markFailed($key);
    }

    if (! $response->successful() || $response->json('code') !== 200) {
      return self::markFailed($key);
    }

    $rawDays = $response->json('data');
    if (! is_array($rawDays) || $rawDays === []) {
      return self::markFailed($key);
    }

    $days = [];
    foreach ($rawDays as $entry) {
      if (! is_array($entry)) {
        continue;
      }
      $timings = $entry['timings'] ?? null;
      $gregDate = $entry['date']['gregorian']['date'] ?? null;
      if (! is_array($timings) || ! is_string($gregDate)) {
        continue;
      }

      try {
        $parsed = \Illuminate\Support\Carbon::createFromFormat('d-m-Y', $gregDate);
      } catch (\Throwable) {
        continue;
      }

      $normalized = [];
      foreach (self::PRAYERS as $prayer) {
        if (isset($timings[$prayer])) {
          $normalized[$prayer] = substr((string) $timings[$prayer], 0, 5);
        }
      }

      if ($normalized === []) {
        continue;
      }

      $hijri = self::parseHijri($entry['date']['hijri'] ?? null);
      $days[] = [
        'date' => $parsed->format('Y-m-d'),
        'gregorian_day' => (int) $parsed->format('j'),
        'weekday_ar' => self::WEEKDAYS_AR[$parsed->dayOfWeek] ?? '',
        'hijri_day' => $hijri['day'] ?? '',
        'hijri_month' => $hijri['month'] ?? '',
        'hijri_year' => $hijri['year'] ?? '',
        'timings' => $normalized,
      ];
    }

    if ($days === []) {
      return self::markFailed($key);
    }

    $payload = [
      'year' => $year,
      'month' => $month,
      'month_ar' => self::SYRIAN_MONTHS_AR[$month] ?? '',
      'days' => $days,
    ];

    Cache::put($key, $payload, $today->copy()->endOfMonth()->timestamp - $today->timestamp + 1);

    return $payload;
  }

  /**
   * Qibla bearing from true north toward the Kaaba (21.4225, 39.8262).
   *
   * @return array{degrees: float, direction_ar: string, description_ar: string}|null
   */
  public static function qiblaForGovernorate(string $governorate): ?array
  {
    $gov = Facts::governorate($governorate);
    if ($gov === null) {
      return null;
    }

    $lat1 = deg2rad((float) $gov['lat']);
    $lon1 = deg2rad((float) $gov['lng']);
    $lat2 = deg2rad(self::KAABA_LAT);
    $lon2 = deg2rad(self::KAABA_LNG);
    $dLon = $lon2 - $lon1;

    $y = sin($dLon) * cos($lat2);
    $x = cos($lat1) * sin($lat2) - sin($lat1) * cos($lat2) * cos($dLon);
    $bearing = fmod(rad2deg(atan2($y, $x)) + 360.0, 360.0);
    $degrees = round($bearing, 1);

    $direction = match (true) {
      $bearing >= 337.5 || $bearing < 22.5 => 'الشمال',
      $bearing < 67.5 => 'الشمال الشرقي',
      $bearing < 112.5 => 'الشرق',
      $bearing < 157.5 => 'الجنوب الشرقي',
      $bearing < 202.5 => 'الجنوب',
      $bearing < 247.5 => 'الجنوب الغربي',
      $bearing < 292.5 => 'الغرب',
      default => 'الشمال الغربي',
    };

    $formattedDegrees = number_format($degrees, 1, '.', '');
    $description = "يتجه القبلة في {$gov['name_ar']} بزاوية {$formattedDegrees}° من الشمال الحقيقي باتجاه {$direction} نحو الكعبة المشرفة.";

    return [
      'degrees' => $degrees,
      'direction_ar' => $direction,
      'description_ar' => $description,
    ];
  }

  /**
   * Today's date in Asia/Damascus for SSR consistency.
   *
   * @return array{iso: string, gregorian_ar: string}
   */
  public static function todaySyriaInfo(): array
  {
    $today = now()->timezone(self::timezone());
    $weekday = self::WEEKDAYS_AR[$today->dayOfWeek] ?? '';
    $month = self::SYRIAN_MONTHS_AR[(int) $today->format('n')] ?? '';

    return [
      'iso' => $today->format('Y-m-d'),
      'gregorian_ar' => "{$weekday}، {$today->format('j')} {$month} {$today->format('Y')}",
    ];
  }

  private static function calendarBaseUrl(): string
  {
    $timingsUrl = rtrim((string) config('services.prayer.url', 'https://api.aladhan.com/v1/timings'), '/');

    return str_ends_with($timingsUrl, '/timings')
      ? substr($timingsUrl, 0, -strlen('/timings'))
      : 'https://api.aladhan.com/v1';
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
    return self::parseHijri($hijri);
  }

  /**
   * @return array{day:string,month:string,year:string}|null
   */
  private static function parseHijri(mixed $hijri): ?array
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
