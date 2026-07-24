<?php

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Cache::flush();
});

afterEach(function () {
    Carbon::setTestNow();
});

// Shaped like the real api.aladhan.com response, verified against a live call.
function prayerPayload(string $fajr = '04:00', string $hijriDay = '6'): array
{
    return [
        'code' => 200,
        'data' => [
            'timings' => [
                'Fajr' => $fajr,
                'Sunrise' => '05:39',
                'Dhuhr' => '12:41',
                'Asr' => '16:25',
                'Sunset' => '19:43',
                'Maghrib' => '19:43',
                'Isha' => '21:15',
                'Imsak' => '03:50',
                'Midnight' => '00:41',
            ],
            'date' => [
                'readable' => '20 Jul 2026',
                'hijri' => [
                    'date' => '06-02-1448',
                    'day' => $hijriDay,
                    'month' => ['number' => 2, 'en' => 'Safar', 'ar' => 'صَفَر'],
                    'year' => '1448',
                ],
            ],
        ],
    ];
}

test('returns normalized timings and hijri date for a known governorate', function () {
    Http::fake(['*' => Http::response(prayerPayload(), 200)]);

    $this->getJson('/api/prayer-times?governorate=aleppo')
        ->assertOk()
        ->assertJson([
            'governorate' => 'aleppo',
            'timings' => [
                'Fajr' => '04:00',
                'Sunrise' => '05:39',
                'Dhuhr' => '12:41',
                'Asr' => '16:25',
                'Maghrib' => '19:43',
                'Isha' => '21:15',
            ],
            'hijri' => ['day' => '6', 'month' => 'صَفَر', 'year' => '1448'],
        ])
      // the keys the widget never reads are dropped rather than passed through
        ->assertJsonMissingPath('timings.Imsak')
        ->assertJsonMissingPath('timings.Midnight')
        ->assertJsonMissingPath('timings.Sunset');
});

test('trims a timezone suffix off the upstream times', function () {
    Http::fake(['*' => Http::response(prayerPayload('04:00 (EEST)'), 200)]);

    $this->getJson('/api/prayer-times?governorate=damascus')
        ->assertOk()
        ->assertJsonPath('timings.Fajr', '04:00');
});

test('sends the coordinates and calculation method of the requested governorate', function () {
    Http::fake(['*' => Http::response(prayerPayload(), 200)]);

    $this->getJson('/api/prayer-times?governorate=latakia')->assertOk();

    Http::assertSent(fn ($request) => str_contains($request->url(), 'latitude=35.5317')
      && str_contains($request->url(), 'longitude=35.7901')
      && str_contains($request->url(), 'method=3'));
});

test('rejects an unknown or missing governorate', function () {
    Http::fake();

    $this->getJson('/api/prayer-times?governorate=mecca')->assertStatus(422);
    $this->getJson('/api/prayer-times')->assertStatus(422);

    // no coordinates are accepted from the client, so this stays an unknown key
    $this->getJson('/api/prayer-times?governorate=&latitude=21.4&longitude=39.8')->assertStatus(422);

    Http::assertNothingSent();
});

test('caches a successful response instead of refetching', function () {
    Http::fake(['*' => Http::response(prayerPayload(), 200)]);

    $this->getJson('/api/prayer-times?governorate=homs')->assertOk();
    $this->getJson('/api/prayer-times?governorate=homs')->assertOk();

    Http::assertSentCount(1);
});

test('caches per governorate, not globally', function () {
    Http::fake(['*' => Http::response(prayerPayload(), 200)]);

    $this->getJson('/api/prayer-times?governorate=homs')->assertOk();
    $this->getJson('/api/prayer-times?governorate=hama')->assertOk();

    Http::assertSentCount(2);
});

// The cache key carries the date, so it must roll over at Damascus midnight
// rather than serve yesterday's timings into the new day.
test('caches per day and refetches after midnight', function () {
    Http::fake(['*' => Http::response(prayerPayload(), 200)]);

    Carbon::setTestNow(Carbon::parse('2026-07-20 22:00:00', 'Asia/Damascus'));
    $this->getJson('/api/prayer-times?governorate=damascus')->assertOk();
    Http::assertSentCount(1);

    // same day, still cached
    Carbon::setTestNow(Carbon::parse('2026-07-20 23:30:00', 'Asia/Damascus'));
    $this->getJson('/api/prayer-times?governorate=damascus')->assertOk();
    Http::assertSentCount(1);

    Carbon::setTestNow(Carbon::parse('2026-07-21 00:30:00', 'Asia/Damascus'));
    $this->getJson('/api/prayer-times?governorate=damascus')->assertOk();
    Http::assertSentCount(2);

    Http::assertSent(fn ($request) => str_contains($request->url(), '/21-07-2026'));
});

// A transient upstream failure must not be cached, or the whole day serves it.
test('does not cache upstream failures', function () {
    Http::fakeSequence()
        ->push('nope', 500)
        ->push(prayerPayload('03:58'), 200);

    $this->getJson('/api/prayer-times?governorate=damascus')
        ->assertStatus(502)
        ->assertJsonPath('message', 'تعذر تحميل المواقيت');

    // the retry reaches upstream, which it could not do if the 500 had been cached
    $this->getJson('/api/prayer-times?governorate=damascus')
        ->assertOk()
        ->assertJsonPath('timings.Fajr', '03:58');
});

// Aladhan answers 200 OK with an error code in the body, so the http status
// alone is not enough to call it a success.
test('treats an upstream code other than 200 as a failure', function () {
    Http::fake(['*' => Http::response(['code' => 400, 'status' => 'BAD_REQUEST', 'data' => 'Invalid date'], 200)]);

    $this->getJson('/api/prayer-times?governorate=damascus')
        ->assertStatus(502)
        ->assertJsonPath('message', 'تعذر تحميل المواقيت');
});

test('handles a malformed upstream payload', function () {
    Http::fake(['*' => Http::response(['code' => 200, 'data' => ['unexpected' => true]], 200)]);

    $this->getJson('/api/prayer-times?governorate=damascus')->assertStatus(502);
});

test('handles an upstream connection error', function () {
    Http::fake(fn () => throw new ConnectionException('timeout'));

    $this->getJson('/api/prayer-times?governorate=damascus')
        ->assertStatus(502)
        ->assertJsonPath('message', 'تعذر تحميل المواقيت');
});

// A missing hijri block is not fatal: the timings are the point of the widget.
test('returns a null hijri date when upstream omits it', function () {
    $payload = prayerPayload();
    unset($payload['data']['date']);
    Http::fake(['*' => Http::response($payload, 200)]);

    $this->getJson('/api/prayer-times?governorate=damascus')
        ->assertOk()
        ->assertJsonPath('hijri', null)
        ->assertJsonPath('timings.Fajr', '04:00');
});
