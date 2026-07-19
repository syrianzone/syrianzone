<?php

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
  Cache::flush();
});

function weatherPayload(float $temp = 21.6, string $desc = 'clear sky'): array {
  return ['main' => ['temp' => $temp], 'weather' => [['description' => $desc, 'icon' => '01d']]];
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

test('rejects an unknown or missing governorate', function () {
  Http::fake();

  $this->getJson('/api/weather?governorate=paris')->assertStatus(422);
  $this->getJson('/api/weather')->assertStatus(422);

  // no coordinates are accepted from the client, so this stays an unknown key
  $this->getJson('/api/weather?governorate=&lat=48.8&lon=2.3')->assertStatus(422);

  Http::assertNothingSent();
});

test('caches a successful response instead of refetching', function () {
  Http::fake(['*' => Http::response(weatherPayload(), 200)]);

  $this->getJson('/api/weather?governorate=homs')->assertOk();
  $this->getJson('/api/weather?governorate=homs')->assertOk();

  Http::assertSentCount(1);
});

test('caches per governorate, not globally', function () {
  Http::fake(['*' => Http::response(weatherPayload(), 200)]);

  $this->getJson('/api/weather?governorate=homs')->assertOk();
  $this->getJson('/api/weather?governorate=hama')->assertOk();

  Http::assertSentCount(2);
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
