<?php

use App\Models\Poll;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

function seedTransitTestCity(string $id = 'homs'): void
{
    $geometry = function (array $shape) {
        $json = json_encode($shape, JSON_THROW_ON_ERROR);
        if (DB::connection()->getDriverName() === 'sqlite') {
            return $json;
        }
        $quoted = DB::connection()->getPdo()->quote($json);

        return DB::raw("ST_GeomFromGeoJSON({$quoted})");
    };

    DB::table('cities')->insert([
        'id' => $id,
        'name_ar' => 'حمص',
        'name_en' => 'Homs',
        'center' => $geometry(['type' => 'Point', 'coordinates' => [36.72, 34.73]]),
        'bounds' => $geometry([
            'type' => 'Polygon',
            'coordinates' => [[[36.5, 34.55], [36.95, 34.55], [36.95, 34.95], [36.5, 34.95], [36.5, 34.55]]],
        ]),
        'zoom' => 12,
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

test('canonical /api/v1/transit/* routes return identical payloads to legacy /api/v1/* aliases', function () {
    if (DB::connection()->getDriverName() === 'sqlite') {
        DB::connection()->getPdo()->sqliteCreateFunction('ST_AsGeoJSON', fn ($value) => $value, 1);
    }

    seedTransitTestCity('homs');
    Cache::forget('transit:cities:api');
    Cache::forget('transit:routes:homs');
    Cache::forget('transit:map-data:homs');

    $canonicalCities = $this->getJson('/api/v1/transit/cities')->assertOk()->json();
    $legacyCities = $this->getJson('/api/v1/cities')->assertOk()->json();
    expect($canonicalCities)->toBe($legacyCities);

    $canonicalRoutes = $this->getJson('/api/v1/transit/cities/homs/routes')->assertOk()->json();
    $legacyRoutes = $this->getJson('/api/v1/cities/homs/routes')->assertOk()->json();
    expect($canonicalRoutes)->toBe($legacyRoutes);

    $canonicalMap = $this->getJson('/api/v1/transit/cities/homs/map')->assertOk()->json();
    $canonicalMapData = $this->getJson('/api/v1/transit/cities/homs/map-data')->assertOk()->json();
    $legacyMapData = $this->getJson('/api/v1/cities/homs/map-data')->assertOk()->json();
    expect($canonicalMap)->toBe($legacyMapData)
        ->and($canonicalMapData)->toBe($legacyMapData);

    $canonicalSearch = $this->getJson('/api/v1/transit/search?q=')->assertOk()->json();
    $legacySearch = $this->getJson('/api/v1/search?q=')->assertOk()->json();
    expect($canonicalSearch)->toBe(['routes' => [], 'stops' => []])
        ->and($canonicalSearch)->toBe($legacySearch);
});

test('canonical /api/v1/transit/pois and legacy /api/v1/geo/poi both validate and serve POI search', function () {
    Http::fake([
        'photon.komoot.io/*' => Http::response([
            'features' => [[
                'geometry' => ['coordinates' => [36.71, 34.73]],
                'properties' => ['name' => 'جامع خالد بن الوليد', 'osm_value' => 'place_of_worship'],
            ]],
        ], 200),
    ]);

    $this->getJson('/api/v1/transit/pois?q=ab')->assertStatus(422);
    $this->getJson('/api/v1/geo/poi?q=ab')->assertStatus(422);

    $canonical = $this->getJson('/api/v1/transit/pois?q=جامع')->assertOk()->json();
    $legacy = $this->getJson('/api/v1/geo/poi?q=جامع')->assertOk()->json();
    expect($canonical)->toBe($legacy)
        ->and($canonical['places'])->toHaveCount(1);
});

test('canonical /api/v1/search/global and legacy /api/v1/global-search return matching cross-module results', function () {
    $canonical = $this->getJson('/api/v1/search/global?q=a')->assertOk()->json();
    $legacy = $this->getJson('/api/v1/global-search?q=a')->assertOk()->json();

    expect($canonical)->toBe($legacy)
        ->and($canonical)->toHaveKeys(['routes', 'places', 'phonebook', 'officials', 'govapps']);
});

test('canonical /api/v1/polls/{idOrSlug}/ballots and /api/v1/polls/{idOrSlug}/leaderboard work alongside legacy poll endpoints', function () {
    $poll = Poll::create([
        'id' => '00000000-0000-0000-0000-000000000099',
        'title' => 'Standard Poll',
        'slug' => 'standard-poll',
        'timezone' => 'Europe/Amsterdam',
        'is_active' => true,
    ]);

    $this->getJson("/api/v1/polls/{$poll->slug}/leaderboard")
        ->assertOk()
        ->assertJsonPath('poll.slug', 'standard-poll');

    $this->postJson("/api/v1/polls/{$poll->slug}/ballots", [
        'tiers' => ['S' => ['c1']],
        'deviceId' => '1234567890',
    ])
        ->assertStatus(400)
        ->assertJsonPath('message', 'Minimum selection is 3');
});

test('canonical /api/v1/atlas and /api/v1/app-icon work alongside legacy unversioned /api/* routes', function () {
    $canonicalAtlas = $this->getJson('/api/v1/atlas')->assertOk()->json();
    $legacyAtlas = $this->getJson('/api/population/master')->assertOk()->json();
    expect($canonicalAtlas)->toBe($legacyAtlas);

    $this->getJson('/api/v1/app-icon?store=invalid')
        ->assertStatus(400)
        ->assertJsonPath('message', 'Unsupported store.')
        ->assertJsonPath('icon', null);
});

test('canonical /api/v1/user/settings and /api/v1/account routes work for authenticated users', function () {
    $user = User::factory()->create(['name' => 'Initial Name']);

    $this->actingAs($user)
        ->patchJson('/api/v1/user/settings', [
            'settings' => ['theme' => 'dark', 'language' => 'ar'],
        ])
        ->assertOk()
        ->assertJsonPath('status', 'ok')
        ->assertJsonPath('settings.theme', 'dark');

    $this->actingAs($user)
        ->patchJson('/api/v1/account', [
            'name' => 'Updated Name',
            'email' => $user->email,
        ])
        ->assertRedirect();

    expect($user->fresh()->name)->toBe('Updated Name');
});

test('canonical named api.v1.* routes resolve to expected paths', function () {
    expect(route('api.v1.search.global', [], false))->toBe('/api/v1/search/global')
        ->and(route('api.v1.transit.cities.index', [], false))->toBe('/api/v1/transit/cities')
        ->and(route('api.v1.transit.cities.routes.index', ['id' => 'damascus'], false))->toBe('/api/v1/transit/cities/damascus/routes')
        ->and(route('api.v1.transit.cities.map', ['id' => 'damascus'], false))->toBe('/api/v1/transit/cities/damascus/map')
        ->and(route('api.v1.transit.stops.nearby', [], false))->toBe('/api/v1/transit/stops/nearby')
        ->and(route('api.v1.transit.search', [], false))->toBe('/api/v1/transit/search')
        ->and(route('api.v1.transit.pois.index', [], false))->toBe('/api/v1/transit/pois')
        ->and(route('api.v1.polls.index', [], false))->toBe('/api/v1/polls')
        ->and(route('api.v1.polls.leaderboard', ['idOrSlug' => 'best-ministers'], false))->toBe('/api/v1/polls/best-ministers/leaderboard')
        ->and(route('api.v1.polls.ballots.store', ['idOrSlug' => 'best-ministers'], false))->toBe('/api/v1/polls/best-ministers/ballots')
        ->and(route('api.v1.places.index', [], false))->toBe('/api/v1/places')
        ->and(route('api.v1.atlas.index', [], false))->toBe('/api/v1/atlas');
});
