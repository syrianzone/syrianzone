<?php

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Cache::flush();
    Carbon::setTestNow(Carbon::parse('2026-11-14 12:00:00', 'Asia/Damascus'));
    Http::preventStrayRequests();
});

afterEach(function () { Carbon::setTestNow(); });

function timezonePrayerPayload(?string $zone): array
{
    return ['code' => 200, 'data' => ['meta' => ['timezone' => $zone], 'timings' => [
        'Fajr' => '05:00', 'Sunrise' => '06:15', 'Dhuhr' => '12:00',
        'Asr' => '15:00', 'Maghrib' => '18:00', 'Isha' => '19:30',
    ]]];
}

test('prayer metadata adds authoritative timezone and requested date without changing old timing fields', function () {
    Http::fake(['*' => Http::response(timezonePrayerPayload('Europe/Amsterdam'))]);
    $this->getJson('/api/v1/prayer-times?latitude=52.37&longitude=4.90')
        ->assertOk()->assertJsonPath('timezone', 'Europe/Amsterdam')
        ->assertJsonPath('date', '2026-11-14')->assertJsonPath('timings.Fajr', '05:00');
});

test('legacy governorate cache entries gain known timezone and date without refetching', function () {
    Cache::put('prayer:damascus:3:2026-11-14', ['governorate' => 'damascus', 'timings' => ['Fajr' => '05:00']], 300);
    Http::fake();
    $this->getJson('/api/v1/prayer-times?governorate=damascus')->assertOk()
        ->assertJsonPath('timezone', 'Asia/Damascus')->assertJsonPath('date', '2026-11-14');
    Http::assertNothingSent();
});

test('custom locations never receive a guessed timezone when upstream metadata is missing or invalid', function () {
    Http::fake(['*' => Http::response(timezonePrayerPayload('Not/A_Zone'))]);
    $this->getJson('/api/v1/prayer-times?latitude=52.37&longitude=4.90')->assertOk()->assertJsonPath('timezone', null);
});

test('explicit local dates are bounded and cached separately while the default keeps the Damascus day', function () {
    Http::fake(['*' => Http::response(timezonePrayerPayload('Pacific/Auckland'))]);
    $base = '/api/v1/prayer-times?latitude=-36.85&longitude=174.76';
    $this->getJson($base.'&date=2026-11-15')->assertOk()->assertJsonPath('date', '2026-11-15');
    $this->getJson($base.'&date=2026-11-15')->assertOk();
    $this->getJson($base)->assertOk()->assertJsonPath('date', '2026-11-14');
    Http::assertSentCount(2);
    Http::assertSent(fn ($request) => str_contains($request->url(), '/15-11-2026'));
    $this->getJson($base.'&date=2026-12-01')->assertStatus(422);
    $this->getJson($base.'&date=2026-02-30')->assertStatus(422);
    Http::assertSentCount(2);
});
