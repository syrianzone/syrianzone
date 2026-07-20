<?php

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
  Cache::flush();
});

function eventRow(array $overrides = []): array {
  return array_merge([
    'id' => '1647',
    'name' => 'بطولة الشطرنج',
    'address' => 'قطنا - المركز الثقافي العربي',
    'isOnline' => false,
    'eventLink' => 'https://app.f3alia.com/?event_id=1647',
    'province' => 'DAMASCUS',
    'provinceName' => 'دمشق',
    'isFree' => true,
    'ticketPrice' => 0.0,
    'eventDate' => now()->toDateString(),
    'eventTime' => '09:00:00',
    'endDate' => now()->toDateString(),
    'endTime' => '23:59:00',
    'category' => ['nameAr' => 'رياضية و صحية', 'nameEn' => 'Sports'],
    'owner' => ['organizerName' => 'المركز الثقافي', 'logoImage' => null],
  ], $overrides);
}

function eventsPayload(array $rows): array {
  return ['data' => ['getAllEventsForVisitor' => [
    'totalElements' => count($rows),
    'content' => $rows,
  ]]];
}

test('normalizes a realistic upstream payload', function () {
  Http::fake(['*' => Http::response(eventsPayload([
    eventRow(),
    eventRow(['id' => '1700', 'name' => 'حفل', 'isFree' => false, 'ticketPrice' => 25000.0, 'eventLink' => null]),
  ]), 200)]);

  $response = $this->getJson('/api/events/today?governorate=damascus')->assertOk();

  $response->assertJsonPath('governorate', 'damascus')
    ->assertJsonPath('is_fallback', false)
    ->assertJsonCount(2, 'events')
    ->assertJsonPath('events.0.id', '1647')
    ->assertJsonPath('events.0.name', 'بطولة الشطرنج')
    ->assertJsonPath('events.0.url', 'https://app.f3alia.com/?event_id=1647')
    ->assertJsonPath('events.0.event_time', '09:00:00')
    ->assertJsonPath('events.0.category', 'رياضية و صحية')
    ->assertJsonPath('events.0.organizer', 'المركز الثقافي')
    ->assertJsonPath('events.0.is_free', true)
    // a free event carries no price, so the widget never renders "0 ل.س"
    ->assertJsonPath('events.0.ticket_price', null)
    ->assertJsonPath('events.1.is_free', false)
    ->assertJsonPath('events.1.ticket_price', 25000)
    // a row without a link falls back to resolving the event by id
    ->assertJsonPath('events.1.url', 'https://app.f3alia.com/?event_id=1700');
});

// The core invariant: "today" is an interval test, not an equality test on
// eventDate. Upstream only offers fromDate, so this filtering is ours.
test('includes a multi day event spanning today and excludes a future one', function () {
  Http::fake(['*' => Http::response(eventsPayload([
    eventRow([
      'id' => 'spanning',
      'eventDate' => now()->subDays(4)->toDateString(),
      'endDate' => now()->addDays(40)->toDateString(),
    ]),
    eventRow(['id' => 'today-only']),
    // ends today, started earlier: still happening today
    eventRow([
      'id' => 'ends-today',
      'eventDate' => now()->subDays(4)->toDateString(),
      'endDate' => now()->toDateString(),
    ]),
    // starts tomorrow: not today
    eventRow([
      'id' => 'future',
      'eventDate' => now()->addDay()->toDateString(),
      'endDate' => now()->addDay()->toDateString(),
    ]),
    // ended yesterday: not today
    eventRow([
      'id' => 'past',
      'eventDate' => now()->subDays(9)->toDateString(),
      'endDate' => now()->subDay()->toDateString(),
    ]),
    // no endDate at all: a single day event ends when it starts
    eventRow(['id' => 'open-ended-future', 'eventDate' => now()->addDay()->toDateString(), 'endDate' => null]),
    eventRow(['id' => 'open-ended-today', 'endDate' => null]),
  ]), 200)]);

  $ids = $this->getJson('/api/events/today?governorate=damascus')
    ->assertOk()
    ->json('events.*.id');

  expect($ids)->toBe(['spanning', 'today-only', 'ends-today', 'open-ended-today']);
});

test('caps the list at ten events', function () {
  $rows = [];
  foreach (range(1, 25) as $n) {
    $rows[] = eventRow(['id' => (string) $n]);
  }
  Http::fake(['*' => Http::response(eventsPayload($rows), 200)]);

  $this->getJson('/api/events/today?governorate=damascus')
    ->assertOk()
    ->assertJsonCount(10, 'events');
});

test('rejects an unknown or missing governorate', function () {
  Http::fake();

  $this->getJson('/api/events/today?governorate=paris')->assertStatus(422);
  $this->getJson('/api/events/today')->assertStatus(422);

  Http::assertNothingSent();
});

test('accepts the all syria option and sends a null province', function () {
  Http::fake(['*' => Http::response(eventsPayload([eventRow()]), 200)]);

  $this->getJson('/api/events/today?governorate=all')
    ->assertOk()
    ->assertJsonPath('governorate', 'all')
    ->assertJsonPath('is_fallback', false);

  Http::assertSent(fn ($request) => $request['variables']['province'] === null);
});

test('maps the governorate key to the f3alia province enum server side', function () {
  Http::fake(['*' => Http::response(eventsPayload([eventRow()]), 200)]);

  $this->getJson('/api/events/today?governorate=sweida')->assertOk();

  Http::assertSent(fn ($request) => $request['variables']['province'] === 'AS_SUWAYDA'
    && $request['variables']['fromDate'] === now()->toDateString());
});

test('folds rural damascus onto the damascus province', function () {
  Http::fake(['*' => Http::response(eventsPayload([eventRow()]), 200)]);

  $this->getJson('/api/events/today?governorate=rural-damascus')->assertOk();

  Http::assertSent(fn ($request) => $request['variables']['province'] === 'DAMASCUS');
});

test('falls back to all syria when the governorate has nothing today', function () {
  Http::fakeSequence()
    ->push(eventsPayload([]), 200)
    ->push(eventsPayload([eventRow(['id' => 'elsewhere'])]), 200);

  $this->getJson('/api/events/today?governorate=quneitra')
    ->assertOk()
    ->assertJsonPath('is_fallback', true)
    ->assertJsonPath('events.0.id', 'elsewhere');

  Http::assertSentCount(2);
});

// A governorate whose only events are future-dated is empty for *today* even
// though upstream returned rows, so the fallback has to fire off the filtered
// list rather than the raw response.
test('falls back when the governorate returns only future events', function () {
  Http::fakeSequence()
    ->push(eventsPayload([eventRow(['id' => 'later', 'eventDate' => now()->addWeek()->toDateString(), 'endDate' => now()->addWeek()->toDateString()])]), 200)
    ->push(eventsPayload([eventRow(['id' => 'elsewhere'])]), 200);

  $this->getJson('/api/events/today?governorate=quneitra')
    ->assertOk()
    ->assertJsonPath('is_fallback', true)
    ->assertJsonCount(1, 'events')
    ->assertJsonPath('events.0.id', 'elsewhere');
});

test('reports an empty day rather than failing when nothing is on anywhere', function () {
  Http::fake(['*' => Http::response(eventsPayload([]), 200)]);

  $this->getJson('/api/events/today?governorate=quneitra')
    ->assertOk()
    ->assertJsonPath('is_fallback', false)
    ->assertJsonCount(0, 'events');
});

test('caches a successful response instead of refetching', function () {
  Http::fake(['*' => Http::response(eventsPayload([eventRow()]), 200)]);

  $this->getJson('/api/events/today?governorate=homs')->assertOk();
  $this->getJson('/api/events/today?governorate=homs')->assertOk();

  Http::assertSentCount(1);
});

test('caches per governorate, not globally', function () {
  Http::fake(['*' => Http::response(eventsPayload([eventRow()]), 200)]);

  $this->getJson('/api/events/today?governorate=homs')->assertOk();
  $this->getJson('/api/events/today?governorate=hama')->assertOk();

  Http::assertSentCount(2);
});

// The key carries the date, so a payload cached before midnight cannot be
// served as "today" after it.
test('the cache key rolls over at midnight', function () {
  // generated per request so the row is dated whatever "today" is at the time of
  // the call, otherwise the pre-midnight call sees a future event and falls back
  Http::fake(fn () => Http::response(eventsPayload([
    eventRow(['eventDate' => now()->toDateString(), 'endDate' => now()->toDateString()]),
  ]), 200));

  $this->travelTo(now()->startOfDay()->subMinutes(5));
  $this->getJson('/api/events/today?governorate=homs')->assertOk();

  $this->travelTo(now()->addMinutes(10));
  $this->getJson('/api/events/today?governorate=homs')->assertOk();

  Http::assertSentCount(2);
});

// A transient upstream failure must not be cached, or the whole ttl serves it.
test('does not cache upstream failures', function () {
  Http::fakeSequence()
    ->push('nope', 500)
    ->push(eventsPayload([eventRow()]), 200);

  $this->getJson('/api/events/today?governorate=damascus')
    ->assertStatus(502)
    ->assertJsonPath('message', 'تعذر تحميل الفعاليات');

  // the retry reaches upstream, which it could not do if the 500 had been cached
  $this->getJson('/api/events/today?governorate=damascus')
    ->assertOk()
    ->assertJsonCount(1, 'events');
});

// GraphQL answers 200 with an `errors` array on a failed query, so the status
// code alone says nothing about whether we got data.
test('treats a graphql errors array as an upstream failure', function () {
  Http::fake(['*' => Http::response([
    'errors' => [['message' => 'Validation error: unknown province']],
    'data' => null,
  ], 200)]);

  $this->getJson('/api/events/today?governorate=damascus')
    ->assertStatus(502)
    ->assertJsonPath('message', 'تعذر تحميل الفعاليات');
});

test('handles a malformed upstream payload', function () {
  Http::fake(['*' => Http::response(['unexpected' => true], 200)]);

  $this->getJson('/api/events/today?governorate=damascus')->assertStatus(502);
});

test('handles an upstream connection error', function () {
  Http::fake(fn () => throw new \Illuminate\Http\Client\ConnectionException('timeout'));

  $this->getJson('/api/events/today?governorate=damascus')->assertStatus(502);
});
