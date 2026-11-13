<?php

namespace App\Http\Controllers;

use App\Support\Facts;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class EventsController extends Controller
{
  // Server-side proxy for the F3alia events GraphQL API, for the same reason
  // WeatherController proxies the weather worker: a third-party host is never
  // called from the browser. Fetching here also gives us caching, a stable
  // normalized shape, and one place to do the "today" filtering.
  //
  // The governorate key is validated against the shared governorate table
  // rather than passed through, so this cannot become an open GraphQL proxy and
  // the cache stays bounded. The F3alia province id per governorate comes from
  // that table too (rural Damascus folds into Damascus upstream).

  // the all-syria option: no province filter upstream
  private const ALL = 'all';

  // `today` is the "happening now" list the widgets show; `upcoming` is the next
  // event the homepage spotlight shows. Both are answered from the same query.
  private const SCOPES = ['today', 'upcoming'];

  /**
   * Governorate id => the F3alia province enum upstream uses.
   *
   * @return array<string, string>
   */
  private static function provinces(): array
  {
    $out = [];
    foreach (Facts::governorates() as $row) {
      $out[$row['id']] = $row['f3alia_province'];
    }

    return $out;
  }

  private const TTL = 600;

  private const LIMIT = 10;

  // fetched wide because the "today" filter runs here, not upstream: asking for
  // 10 would let a run of future-dated events crowd out today's.
  private const FETCH_SIZE = 60;

  private const QUERY = <<<'GRAPHQL'
    query GetEvents($province: Province, $fromDate: Date, $size: Int!) {
      getAllEventsForVisitor(page: 0, size: $size, province: $province, fromDate: $fromDate) {
        totalElements
        content {
          id
          name
          address
          isOnline
          eventLink
          province
          provinceName
          isFree
          ticketPrice
          eventDate
          eventTime
          endDate
          endTime
          category { nameAr nameEn }
          owner { organizerName logoImage }
        }
      }
    }
    GRAPHQL;

  public function today(Request $request)
  {
    $provinces = self::provinces();
    $keys = array_merge(array_keys($provinces), [self::ALL]);

    $validated = $request->validate([
      'governorate' => 'required|string|in:'.implode(',', $keys),
      'scope' => 'sometimes|in:'.implode(',', self::SCOPES),
    ], [
      'governorate.required' => 'المحافظة مطلوبة',
      'governorate.in' => 'محافظة غير معروفة',
      'scope.in' => 'نطاق غير معروف',
    ]);

    $governorate = $validated['governorate'];
    $scope = $validated['scope'] ?? 'today';
    $today = now()->toDateString();

    // the date is part of the key so a cached payload cannot outlive the day it
    // describes: at midnight every key rolls over instead of serving yesterday
    $cacheKey = "events:{$scope}:{$governorate}:{$today}";
    $cached = Cache::get($cacheKey);
    if ($cached !== null) {
      return response()->json($cached)->header('Cache-Control', 'public, max-age=300');
    }

    $province = self::provinces()[$governorate] ?? null;

    $events = $this->fetch($province, $today, $scope);
    if ($events === null) {
      return $this->failed();
    }

    // Mirror the existing client behaviour: an empty governorate falls back to
    // all of syria rather than showing nothing, and says so in the payload.
    $isFallback = false;
    if ($events === [] && $province !== null) {
      $all = $this->fetch(null, $today, $scope);
      if ($all === null) {
        return $this->failed();
      }
      if ($all !== []) {
        $events = $all;
        $isFallback = true;
      }
    }

    $payload = [
      'governorate' => $governorate,
      'is_fallback' => $isFallback,
      'events' => array_slice($events, 0, self::LIMIT),
    ];

    Cache::put($cacheKey, $payload, self::TTL);

    return response()->json($payload)->header('Cache-Control', 'public, max-age=300');
  }

  // Returns the normalized events for the scope, or null on any upstream
  // problem. Null is never cached: a transient failure must not stick for the
  // whole ttl.
  private function fetch(?string $province, string $today, string $scope): ?array
  {
    try {
      $response = Http::timeout(8)
        ->acceptJson()
        ->post(config('services.events.url'), [
          'query' => self::QUERY,
          'variables' => [
            'province' => $province,
            'fromDate' => $today,
            'size' => self::FETCH_SIZE,
          ],
        ]);
    } catch (\Throwable $e) {
      return null;
    }

    if (! $response->successful()) {
      return null;
    }

    // graphql answers 200 with an `errors` array on a failed query, so the
    // status code alone says nothing about whether we got data
    if (! empty($response->json('errors'))) {
      return null;
    }

    $content = $response->json('data.getAllEventsForVisitor.content');
    if (! is_array($content)) {
      return null;
    }

    $events = [];
    foreach ($content as $raw) {
      if (! is_array($raw) || ! isset($raw['id'])) {
        continue;
      }
      $matches = $scope === 'upcoming'
        ? $this->happeningFrom($raw, $today)
        : $this->happeningToday($raw, $today);
      if (! $matches) {
        continue;
      }
      $events[] = $this->normalize($raw);
    }

    return $events;
  }

  // "Today" is an interval, not a start date. A workshop running the 16th to the
  // 30th is happening today; one starting tomorrow is not. Upstream only offers
  // fromDate, so the interval test lives here.
  private function happeningToday(array $raw, string $today): bool
  {
    $start = $raw['eventDate'] ?? null;
    if (! is_string($start) || $start === '') {
      return false;
    }

    $end = $raw['endDate'] ?? null;
    // a single-day event has no distinct end, so it ends when it starts
    $end = is_string($end) && $end !== '' ? $end : $start;

    // iso dates compare correctly as strings
    return $start <= $today && $end >= $today;
  }

  // Anything that has not finished yet: the homepage spotlight asks for the
  // next event, not only today's.
  private function happeningFrom(array $raw, string $today): bool
  {
    $start = $raw['eventDate'] ?? null;
    if (! is_string($start) || $start === '') {
      return false;
    }

    return $start >= $today;
  }

  private function normalize(array $raw): array
  {
    $id = (string) $raw['id'];
    $category = $raw['category'] ?? null;
    $owner = $raw['owner'] ?? null;
    $isFree = (bool) ($raw['isFree'] ?? false);
    $price = $raw['ticketPrice'] ?? null;

    return [
      'id' => $id,
      'name' => (string) ($raw['name'] ?? ''),
      'description' => (string) ($raw['description'] ?? ''),
      // some rows come back without a link; the platform resolves an event by id
      'url' => ! empty($raw['eventLink'])
        ? (string) $raw['eventLink']
        : "https://app.f3alia.com/?event_id={$id}",
      'address' => (string) ($raw['address'] ?? ''),
      'is_online' => (bool) ($raw['isOnline'] ?? false),
      'is_free' => $isFree,
      // null rather than 0 for a free event, so the widget never renders "0 ل.س"
      'ticket_price' => $isFree || $price === null ? null : (float) $price,
      'event_date' => (string) ($raw['eventDate'] ?? ''),
      'event_time' => ! empty($raw['eventTime']) ? (string) $raw['eventTime'] : null,
      // the event's own province, for the "showing all of Syria" fallback label
      'province' => (string) ($raw['province'] ?? ''),
      'provinceName' => (string) ($raw['provinceName'] ?? ''),
      'category' => ! empty($category['nameAr']) ? (string) $category['nameAr'] : null,
      'organizer' => ! empty($owner['organizerName']) ? (string) $owner['organizerName'] : null,
    ];
  }

  private function failed()
  {
    return response()->json(['message' => 'تعذر تحميل الفعاليات'], 502);
  }
}
