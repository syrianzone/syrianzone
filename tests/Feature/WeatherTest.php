<?php

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
  Cache::flush();
});

function weatherPayload(float $temp = 21.6, string $desc = 'clear sky'): array {
  return ['main' => ['temp' => $temp], 'weather' => [['description' => $desc, 'icon' => '01d']]];
}

// Shaped like api.open-meteo.com/v1/forecast, verified against a live call.
function forecastPayload(int $days = 5): array {
  $time = $min = $max = $code = [];
  for ($i = 0; $i < $days; $i++) {
    $time[] = '2026-07-'.str_pad((string) (20 + $i), 2, '0', STR_PAD_LEFT);
    $min[] = 21.6 + $i;
    $max[] = 36.7 + $i;
    $code[] = $i % 3;
  }

  return ['daily' => ['time' => $time, 'temperature_2m_min' => $min, 'temperature_2m_max' => $max, 'weather_code' => $code]];
}

// The endpoint now talks to two upstreams, so a bare assertSentCount would
// count both. These narrow each assertion to the host it is actually about.
function sentToWorker(): int {
  return Http::recorded(fn ($request) => ! str_contains($request->url(), 'open-meteo'))->count();
}

function sentToForecast(): int {
  return Http::recorded(fn ($request) => str_contains($request->url(), 'open-meteo'))->count();
}

test('returns normalized weather for a known governorate', function () {
  Http::fake(['*' => Http::response(weatherPayload(), 200)]);

  $this->getJson('/api/weather?governorate=aleppo')
    ->assertOk()
    ->assertJson(['governorate' => 'aleppo', 'temp' => 22, 'description' => 'clear sky', 'icon' => '01d']);
});

test('sends the coordinates of the requested governorate', function () {
  Http::fake(['*' => Http::response(weatherPayload(), 200)]);

  $this->getJson('/api/weather?governorate=latakia')->assertOk();

  Http::assertSent(fn ($request) => str_contains($request->url(), 'lat=35.5317')
    && str_contains($request->url(), 'lon=35.7901'));
});

test('rejects missing or invalid governorate and coordinates', function () {
  Http::fake();

  $this->getJson('/api/weather?governorate=invalid')->assertStatus(422);
  $this->getJson('/api/weather')->assertStatus(422);

  Http::assertNothingSent();
});

test('caches a successful response instead of refetching', function () {
  Http::fake(['*' => Http::response(weatherPayload(), 200)]);

  $this->getJson('/api/weather?governorate=homs')->assertOk();
  $this->getJson('/api/weather?governorate=homs')->assertOk();

  expect(sentToWorker())->toBe(1);
});

test('caches per governorate, not globally', function () {
  Http::fake(['*' => Http::response(weatherPayload(), 200)]);

  $this->getJson('/api/weather?governorate=homs')->assertOk();
  $this->getJson('/api/weather?governorate=hama')->assertOk();

  expect(sentToWorker())->toBe(2);
});

// A transient upstream failure must not be cached, or the whole ttl serves it.
test('does not cache upstream failures', function () {
  Http::fakeSequence()
    ->push('nope', 500)
    ->push(weatherPayload(18.2), 200);

  $this->getJson('/api/weather?governorate=damascus')
    ->assertStatus(502)
    ->assertJsonPath('message', 'تعذر تحميل الطقس');

  // the retry reaches upstream, which it could not do if the 500 had been cached
  $this->getJson('/api/weather?governorate=damascus')
    ->assertOk()
    ->assertJsonPath('temp', 18);
});

test('handles a malformed upstream payload', function () {
  Http::fake(['*' => Http::response(['unexpected' => true], 200)]);

  $this->getJson('/api/weather?governorate=damascus')->assertStatus(502);
});

test('handles an upstream connection error', function () {
  Http::fake(fn () => throw new \Illuminate\Http\Client\ConnectionException('timeout'));

  $this->getJson('/api/weather?governorate=damascus')->assertStatus(502);
});

test('returns a forecast alongside current conditions', function () {
  Http::fake([
    'api.open-meteo.com/*' => Http::response(forecastPayload(), 200),
    '*' => Http::response(weatherPayload(), 200),
  ]);

  $this->getJson('/api/weather?governorate=damascus')
    ->assertOk()
    // the shipped keys are untouched
    ->assertJson(['governorate' => 'damascus', 'temp' => 22, 'description' => 'clear sky', 'icon' => '01d'])
    ->assertJsonCount(5, 'forecast')
    ->assertJsonPath('forecast.0', ['date' => '2026-07-20', 'min' => 22, 'max' => 37, 'code' => 0])
    ->assertJsonPath('forecast.4.date', '2026-07-24');
});

test('sends the coordinates of the requested governorate to the forecast upstream', function () {
  Http::fake([
    'api.open-meteo.com/*' => Http::response(forecastPayload(), 200),
    '*' => Http::response(weatherPayload(), 200),
  ]);

  $this->getJson('/api/weather?governorate=latakia')->assertOk();

  Http::assertSent(fn ($request) => str_contains($request->url(), 'open-meteo')
    && str_contains($request->url(), 'latitude=35.5317')
    && str_contains($request->url(), 'longitude=35.7901'));
});

// The most important behaviour here: the forecast is additive. Losing it must
// never cost the current temperature, which is what the widget is mostly for.
test('still returns current conditions when the forecast upstream fails', function () {
  Http::fake([
    'api.open-meteo.com/*' => Http::response('nope', 503),
    '*' => Http::response(weatherPayload(), 200),
  ]);

  $this->getJson('/api/weather?governorate=damascus')
    ->assertOk()
    ->assertJsonPath('temp', 22)
    ->assertJsonPath('description', 'clear sky')
    ->assertJsonPath('forecast', []);
});

test('still returns current conditions when the forecast upstream times out', function () {
  Http::fake([
    'api.open-meteo.com/*' => fn () => throw new \Illuminate\Http\Client\ConnectionException('timeout'),
    '*' => Http::response(weatherPayload(), 200),
  ]);

  $this->getJson('/api/weather?governorate=damascus')
    ->assertOk()
    ->assertJsonPath('temp', 22)
    ->assertJsonPath('forecast', []);
});

test('still returns current conditions when the forecast payload is malformed', function () {
  Http::fake([
    'api.open-meteo.com/*' => Http::response(['unexpected' => true], 200),
    '*' => Http::response(weatherPayload(), 200),
  ]);

  $this->getJson('/api/weather?governorate=damascus')
    ->assertOk()
    ->assertJsonPath('temp', 22)
    ->assertJsonPath('forecast', []);
});

test('skips forecast days with a missing temperature', function () {
  $payload = forecastPayload(3);
  $payload['daily']['temperature_2m_min'][1] = null;
  Http::fake([
    'api.open-meteo.com/*' => Http::response($payload, 200),
    '*' => Http::response(weatherPayload(), 200),
  ]);

  $this->getJson('/api/weather?governorate=damascus')
    ->assertOk()
    ->assertJsonCount(2, 'forecast')
    ->assertJsonPath('forecast.1.date', '2026-07-22');
});

// The forecast outlives the current reading, so a current-conditions cache miss
// must not drag the forecast upstream along with it.
test('caches the forecast separately from current conditions', function () {
  Http::fake([
    'api.open-meteo.com/*' => Http::response(forecastPayload(), 200),
    '*' => Http::response(weatherPayload(), 200),
  ]);

  $this->getJson('/api/weather?governorate=damascus')->assertOk();

  // expire the current reading only, the way its shorter ttl eventually does
  Cache::forget('weather:damascus');

  $this->getJson('/api/weather?governorate=damascus')
    ->assertOk()
    ->assertJsonCount(5, 'forecast');

  expect(sentToWorker())->toBe(2);
  expect(sentToForecast())->toBe(1);
});

test('does not cache a failed forecast', function () {
  Http::fake([
    'api.open-meteo.com/*' => Http::sequence()->push('nope', 500)->push(forecastPayload(3), 200),
    '*' => Http::response(weatherPayload(), 200),
  ]);

  $this->getJson('/api/weather?governorate=damascus')
    ->assertOk()
    ->assertJsonPath('forecast', []);

  Cache::forget('weather:damascus');

  // the retry reaches upstream, which it could not do if the 500 had been cached
  $this->getJson('/api/weather?governorate=damascus')
    ->assertOk()
    ->assertJsonCount(3, 'forecast');
});
