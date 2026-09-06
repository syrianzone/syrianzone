<?php

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

function poiPhotonFeature(string $name, string $osmValue, float $lng, float $lat): array
{
    return [
        'type' => 'Feature',
        'geometry' => ['type' => 'Point', 'coordinates' => [$lng, $lat]],
        'properties' => ['name' => $name, 'osm_value' => $osmValue, 'city' => 'دمشق'],
    ];
}

beforeEach(function () {
    Cache::flush();
    Http::preventStrayRequests();
});

test('poi search requires q of 3+ chars', function () {
    $this->getJson('/api/v1/geo/poi')->assertStatus(422);
    $this->getJson('/api/v1/geo/poi?q=ab')->assertStatus(422);
});

test('poi search returns photon results without touching google', function () {
    Http::fake([
        'photon.komoot.io*' => Http::response([
            'features' => [
                poiPhotonFeature('جامع الأموي', 'place_of_worship', 36.29, 33.51),
                poiPhotonFeature('مقهى الروضة', 'cafe', 36.28, 33.52),
                poiPhotonFeature('مطعم بيت ورد', 'restaurant', 36.27, 33.53),
                poiPhotonFeature('مدرسة الفرات', 'school', 36.26, 33.54),
            ],
        ], 200),
    ]);

    $response = $this->getJson('/api/v1/geo/poi?q=جامع')->assertOk();

    expect($response->json('places'))->toHaveCount(4)
        ->and($response->json('places.0'))->toMatchArray([
            'name' => 'جامع الأموي', 'category' => 'دار عبادة', 'source' => 'osm',
        ])
        ->and($response->json('places.1.category'))->toBe('مقهى');

    // 4 Photon hits >= 3, so Google must never be called.
    Http::assertNotSent(fn ($request) => str_contains((string) $request->url(), 'places.googleapis.com'));
});

test('poi search falls back to google on thin photon results', function () {
    config()->set('services.google_places.key', 'test-key');
    Http::fake([
        'photon.komoot.io*' => Http::response([
            'features' => [poiPhotonFeature('جامع صغير', 'place_of_worship', 36.29, 33.51)],
        ], 200),
        'places.googleapis.com*' => Http::response([
            'places' => [
                [
                    'displayName' => ['text' => 'الجامع الأموي الكبير'],
                    'formattedAddress' => 'دمشق',
                    'location' => ['latitude' => 33.511, 'longitude' => 36.291],
                    'types' => ['mosque', 'place_of_worship'],
                ],
            ],
        ], 200),
    ]);

    $response = $this->getJson('/api/v1/geo/poi?q=جامع')->assertOk();
    $places = $response->json('places');

    expect($places)->toHaveCount(2)
        ->and($places[0]['source'])->toBe('osm')
        ->and($places[1])->toMatchArray(['name' => 'الجامع الأموي الكبير', 'category' => 'مسجد', 'source' => 'google']);
});

test('poi search skips google when no key is configured', function () {
    config()->set('services.google_places.key', null);
    Http::fake([
        'photon.komoot.io*' => Http::response(['features' => []], 200),
    ]);

    $this->getJson('/api/v1/geo/poi?q=مقهى')->assertOk()->assertJsonPath('places', []);
    Http::assertNotSent(fn ($request) => str_contains((string) $request->url(), 'places.googleapis.com'));
});

test('poi search never 500s when upstreams fail', function () {
    config()->set('services.google_places.key', 'test-key');
    Http::fake([
        'photon.komoot.io*' => Http::response(null, 500),
        'places.googleapis.com*' => Http::response(null, 500),
    ]);

    $this->getJson('/api/v1/geo/poi?q=مقهى')->assertOk()->assertJsonPath('places', []);
});

test('poi search caches repeat queries', function () {
    Http::fake([
        'photon.komoot.io*' => Http::response([
            'features' => [
                poiPhotonFeature('أ', 'cafe', 36.28, 33.52),
                poiPhotonFeature('ب', 'cafe', 36.27, 33.53),
                poiPhotonFeature('ج', 'cafe', 36.26, 33.54),
            ],
        ], 200),
    ]);

    $this->getJson('/api/v1/geo/poi?q=مقهى')->assertOk();
    $this->getJson('/api/v1/geo/poi?q=مقهى')->assertOk();

    // 'مقهى' expands to 3 parallel variants (مقهى/كافيه/قهوة); the second
    // identical call is served from cache, so exactly 3 upstream hits total.
    Http::assertSentCount(3);
});

test('poi search dedupes google rows matching photon coordinates', function () {
    config()->set('services.google_places.key', 'test-key');
    Http::fake([
        'photon.komoot.io*' => Http::response([
            'features' => [poiPhotonFeature('مقهى الروضة', 'cafe', 36.28001, 33.52001)],
        ], 200),
        'places.googleapis.com*' => Http::response([
            'places' => [
                [
                    'displayName' => ['text' => 'Rawda Cafe'],
                    'formattedAddress' => 'Damascus',
                    'location' => ['latitude' => 33.52002, 'longitude' => 36.28002],
                    'types' => ['cafe'],
                ],
                [
                    'displayName' => ['text' => 'مقهى آخر'],
                    'formattedAddress' => 'دمشق',
                    'location' => ['latitude' => 33.60, 'longitude' => 36.30],
                    'types' => ['cafe'],
                ],
            ],
        ], 200),
    ]);

    $places = $this->getJson('/api/v1/geo/poi?q=مقهى')->assertOk()->json('places');

    expect($places)->toHaveCount(2)
        ->and($places[0]['name'])->toBe('مقهى الروضة')
        ->and($places[1]['name'])->toBe('مقهى آخر');
});

test('poi search biases photon to the syria box without a city', function () {
    Http::fake(['photon.komoot.io*' => Http::response(['features' => []], 200)]);

    $this->getJson('/api/v1/geo/poi?q=مقهى')->assertOk();

    Http::assertSent(function ($request) {
        return str_contains((string) $request->url(), 'photon.komoot.io')
            && $request['bbox'] === '35.5,32,42.5,37.5'
            // Regression: Photon 400s on unsupported `lang` (lang=ar broke
            // every query), so it must never be sent.
            && ! isset($request['lang']);
    });
});

test('poi search rejects unknown cities', function () {
    $this->getJson('/api/v1/geo/poi?q=مقهى&city_id=no-such-city')->assertStatus(422);
});

test('poi search expands a single type word into synonym variants', function () {
    Http::fake(['photon.komoot.io*' => Http::response(['features' => []], 200)]);

    $this->getJson('/api/v1/geo/poi?q=جامع السلام')->assertOk();

    $qs = collect(Http::recorded())
        ->map(function ($r) {
            parse_str((string) parse_url($r[0]->url(), PHP_URL_QUERY), $params);
            return $params['q'] ?? null;
        })
        ->filter()
        ->values()
        ->all();

    expect($qs)->toEqualCanonicalizing(['جامع السلام', 'مسجد السلام', 'مصلى السلام', 'مصلي السلام']);
});

test('poi search expansion keeps the definite article on variants', function () {
    Http::fake(['photon.komoot.io*' => Http::response(['features' => []], 200)]);

    $this->getJson('/api/v1/geo/poi?q=الجامع الأموي')->assertOk();

    $qs = collect(Http::recorded())
        ->map(function ($r) {
            parse_str((string) parse_url($r[0]->url(), PHP_URL_QUERY), $params);
            return $params['q'] ?? null;
        })
        ->filter()
        ->values()
        ->all();

    expect($qs)->toEqualCanonicalizing(['الجامع الأموي', 'المسجد الأموي', 'المصلى الأموي', 'المصلي الأموي']);
});

test('poi search does not expand queries without (or with several) type words', function () {
    Http::fake(['photon.komoot.io*' => Http::response(['features' => []], 200)]);

    $this->getJson('/api/v1/geo/poi?q=الروضة')->assertOk();
    Http::assertSentCount(1);

    Cache::flush();

    $this->getJson('/api/v1/geo/poi?q=مقهى مطعم الشام')->assertOk();
    Http::assertSentCount(2);
});

test('poi search strips diacritics before querying upstream', function () {
    Http::fake(['photon.komoot.io*' => Http::response(['features' => []], 200)]);

    // 'مقهى السّلام' carries a shadda on س; upstream must see 'مقهى السلام'.
    $this->getJson('/api/v1/geo/poi?q=' . urlencode('مقهى السّلام'))->assertOk();

    $qs = collect(Http::recorded())->map(function ($r) {
        parse_str((string) parse_url($r[0]->url(), PHP_URL_QUERY), $params);
        return $params['q'] ?? null;
    })->filter()->all();
    foreach ($qs as $sent) {
        expect($sent)->not->toContain('ّ');
    }
    expect($qs)->toContain('مقهى السلام');
});

test('poi search merges variant hits original-first and keeps districts', function () {
    Http::fake(function ($request) {
        parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $params);
        $q = $params['q'] ?? '';
        if ($q === 'جامع السلام') {
            return Http::response(['features' => [
                array_merge(poiPhotonFeature('جامع السلام', 'place_of_worship', 36.29, 33.51), []),
            ]], 200);
        }
        if ($q === 'مسجد السلام') {
            $f = poiPhotonFeature('مسجد السلام', 'place_of_worship', 36.10, 33.60);
            $f['properties']['district'] = 'جرمانا';
            $f['properties']['city'] = 'ريف دمشق';
            return Http::response(['features' => [$f]], 200);
        }

        return Http::response(['features' => []], 200);
    });

    $places = $this->getJson('/api/v1/geo/poi?q=جامع السلام')->assertOk()->json('places');

    expect($places)->toHaveCount(2)
        ->and($places[0]['name'])->toBe('جامع السلام')
        ->and($places[1])->toMatchArray([
            'name' => 'مسجد السلام', 'district' => 'جرمانا', 'city' => 'ريف دمشق',
        ]);
});
