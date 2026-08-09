<?php

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Cache::flush();
    config()->set('services.frankfurter.url', 'https://rates.test/');
});

function currencyRatesPayload(): array
{
    return [
        ['date' => '2026-08-07', 'base' => 'SYP', 'quote' => 'SYP', 'rate' => 1],
        ['date' => '2026-08-07', 'base' => 'SYP', 'quote' => 'USD', 'rate' => 0.0082],
        ['date' => '2026-08-06', 'base' => 'SYP', 'quote' => 'EUR', 'rate' => 0.0071],
    ];
}

test('renders the public currency converter page', function () {
    $this->get('/currency')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Currency/Index'));
});

test('returns normalized Syrian pound exchange rates', function () {
    Http::fake(['*' => Http::response(currencyRatesPayload(), 200)]);

    $this->getJson('/api/exchange-rates')
        ->assertOk()
        ->assertHeader('Cache-Control', 'max-age=300, public')
        ->assertJson([
            'base' => 'SYP',
            'rates' => [
                'EUR' => ['rate' => 0.0071, 'date' => '2026-08-06'],
                'USD' => ['rate' => 0.0082, 'date' => '2026-08-07'],
            ],
            'source' => 'Frankfurter',
        ])
        ->assertJsonMissingPath('rates.SYP');
});

test('requests the Frankfurter v2 rates endpoint with SYP as the base', function () {
    Http::fake(['*' => Http::response(currencyRatesPayload(), 200)]);

    $this->getJson('/api/exchange-rates')->assertOk();

    Http::assertSent(function ($request) {
        parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);

        return parse_url($request->url(), PHP_URL_SCHEME) === 'https'
            && parse_url($request->url(), PHP_URL_HOST) === 'rates.test'
            && parse_url($request->url(), PHP_URL_PATH) === '/v2/rates'
            && ($query['base'] ?? null) === 'SYP';
    });
});

test('ignores malformed rows while keeping valid rates', function () {
    Http::fake(['*' => Http::response([
        ['date' => '2026-08-07', 'base' => 'SYP', 'quote' => 'USD', 'rate' => 0.0082],
        ['date' => 'not-a-date', 'base' => 'SYP', 'quote' => 'EUR', 'rate' => 0.0071],
        ['date' => '2026-08-07', 'base' => 'EUR', 'quote' => 'GBP', 'rate' => 0.9],
        ['date' => '2026-08-07', 'base' => 'SYP', 'quote' => 'TRY', 'rate' => -1],
        ['unexpected' => true],
    ], 200)]);

    $this->getJson('/api/exchange-rates')
        ->assertOk()
        ->assertJsonCount(1, 'rates')
        ->assertJsonPath('rates.USD.rate', 0.0082)
        ->assertJsonMissingPath('rates.EUR')
        ->assertJsonMissingPath('rates.GBP')
        ->assertJsonMissingPath('rates.TRY');
});

test('caches a successful response instead of refetching', function () {
    Http::fake(['*' => Http::response(currencyRatesPayload(), 200)]);

    $this->getJson('/api/exchange-rates')->assertOk();
    $this->getJson('/api/exchange-rates')->assertOk();

    Http::assertSentCount(1);
});

test('does not cache upstream failures', function () {
    Http::fakeSequence()
        ->push(['message' => 'temporarily unavailable'], 503)
        ->push(currencyRatesPayload(), 200);

    $this->getJson('/api/exchange-rates')
        ->assertStatus(502)
        ->assertJsonPath('message', 'تعذر تحميل أسعار الصرف');

    $this->getJson('/api/exchange-rates')
        ->assertOk()
        ->assertJsonPath('rates.USD.rate', 0.0082);

    Http::assertSentCount(2);
});

test('handles a malformed upstream payload', function () {
    Http::fake(['*' => Http::response(['unexpected' => true], 200)]);

    $this->getJson('/api/exchange-rates')
        ->assertStatus(502)
        ->assertJsonPath('message', 'تعذر تحميل أسعار الصرف');
});

test('handles an upstream connection error', function () {
    Http::fake(fn () => throw new ConnectionException('timeout'));

    $this->getJson('/api/exchange-rates')
        ->assertStatus(502)
        ->assertJsonPath('message', 'تعذر تحميل أسعار الصرف');
});
