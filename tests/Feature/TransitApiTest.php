<?php

use App\Models\User;
use Illuminate\Support\Facades\Cache;

test('city routes list reports integer stop counts, never null', function () {
    seedCity('homs', ['name_ar' => 'حمص', 'name_en' => 'Homs']);
    Cache::forget('transit:routes:homs');

    $route = transitRoute('route-homs-test', 'homs', ['name_ar' => 'خط اختبار']);

    $this->getJson('/api/v1/cities/homs/routes')
        ->assertOk()
        ->assertJsonPath('0.id', 'route-homs-test')
        ->assertJsonPath('0.stopsCount', 0);

    DB::table('stops')->insert([
        'id' => 'stop-homs-test',
        'city_id' => 'homs',
        'name_ar' => 'موقف اختبار',
        'geometry' => DB::connection()->getDriverName() === 'sqlite'
            ? json_encode(['type' => 'Point', 'coordinates' => [36.66, 34.73]])
            : DB::raw("ST_GeomFromGeoJSON('{\"type\":\"Point\",\"coordinates\":[36.66,34.73]}')"),
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    DB::table('route_stop')->insert([
        'route_id' => $route->id,
        'stop_id' => 'stop-homs-test',
        'order' => 1,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    Cache::forget('transit:routes:homs');

    $this->getJson('/api/v1/cities/homs/routes')
        ->assertOk()
        ->assertJsonPath('0.stopsCount', 1);
});

test('cities list exposes name, route count and governorate icon', function () {
    // seedCity stores geometry as JSON text on SQLite; the endpoint reads
    // it back through ST_AsGeoJSON, which MySQL has and SQLite does not. Shim it
    // as an identity function so the payload can be asserted without MySQL.
    if (DB::connection()->getDriverName() === 'sqlite') {
        DB::connection()->getPdo()->sqliteCreateFunction('ST_AsGeoJSON', fn ($value) => $value, 1);
    }

    seedCity('homs', ['name_ar' => 'حمص', 'name_en' => 'Homs']);
    Cache::forget('transit:cities:api');

    $cities = $this->getJson('/api/v1/cities')->assertOk()->json();

    $homs = collect($cities)->firstWhere('id', 'homs');

    expect($homs)->not->toBeNull()
        ->and($homs['nameAr'])->toBe('حمص')
        ->and($homs['nameEn'])->toBe('Homs')
        ->and($homs['routeCount'])->toBe(0)
        ->and($homs['icon']['viewBox'])->not->toBe('')
        ->and($homs['icon']['path'])->not->toBe('');
});

test('unknown city responds 404 instead of a cached empty payload', function () {
    $this->getJson('/api/v1/cities/no-such-city/routes')->assertNotFound();
    $this->getJson('/api/v1/cities/no-such-city/map-data')->assertNotFound();
});

test('guest studio submissions are throttled with an arabic message', function () {
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/v1/studio/routes', [])->assertStatus(422);
    }

    $this->postJson('/api/v1/studio/routes', [])
        ->assertStatus(429)
        ->assertJsonPath('message', 'تم تجاوز حد المحاولات المسموح، يرجى الانتظار قليلاً قبل إعادة المحاولة.')
        ->assertHeader('Retry-After');
});

test('signed-in studio submitters are not held to the guest rate', function () {
    $user = User::factory()->create();

    for ($i = 0; $i < 6; $i++) {
        $this->actingAs($user)->postJson('/api/v1/studio/routes', [])->assertStatus(422);
    }
});

test('the city page carries the same route list as the api', function () {
    seedCity('homs', ['name_ar' => 'حمص', 'name_en' => 'Homs']);
    Cache::forget('transit:routes:homs');

    transitRoute('route-homs-page', 'homs', ['name_ar' => 'خط الصفحة']);
    transitRoute('route-homs-draft', 'homs', ['name_ar' => 'مسودة', 'status' => 'draft']);

    $this->get('/transit/city/homs')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Transit/city/[id]/Index')
            ->where('id', 'homs')
            ->where('routes', $this->getJson('/api/v1/cities/homs/routes')->json())
            ->has('routes', 1)
            ->where('routes.0.nameAr', 'خط الصفحة'));
});

test('the city page carries the city payload the api serves', function () {
    if (DB::connection()->getDriverName() === 'sqlite') {
        DB::connection()->getPdo()->sqliteCreateFunction('ST_AsGeoJSON', fn ($value) => $value, 1);
    }

    seedCity('damascus', ['name_ar' => 'دمشق', 'name_en' => 'Damascus']);
    seedCity('rif-dimashq', ['name_ar' => 'ريف دمشق', 'name_en' => 'Rif Dimashq']);
    Cache::forget('transit:cities');
    Cache::forget('transit:cities:api');

    $api = collect($this->getJson('/api/v1/cities')->assertOk()->json())->keyBy('id');
    $served = $api->get('rif-dimashq');

    $this->get('/transit/city/rif-dimashq')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Transit/city/[id]/Index')
            ->where('city.id', 'rif-dimashq')
            ->where('city.nameAr', $served['nameAr'])
            ->where('city.bounds', $served['bounds'])
            ->where('city.routeCount', $served['routeCount'])
            // The shared map is declared on the server: the client renders the
            // pair's banner and sections from these, never from its own copy.
            ->where('city.mapGroup', ['damascus', 'rif-dimashq'])
            ->where('city.mapGroupLabel', 'دمشق الكبرى')
            ->has('cities', 2));
});

test('the map payload carries one colour key and no phantom stop fields', function () {
    if (DB::connection()->getDriverName() === 'sqlite') {
        DB::connection()->getPdo()->sqliteCreateFunction('ST_AsGeoJSON', fn ($value) => $value, 1);
    }

    seedCity('homs', ['name_ar' => 'حمص', 'name_en' => 'Homs']);
    $route = transitRoute('route-homs-colour', 'homs', [
        'name_ar' => 'خط اللون',
        'color_index' => 3,
        'price_old' => 500,
        'price_new' => 1000,
    ]);

    $line = ['type' => 'LineString', 'coordinates' => [[36.70, 34.72], [36.74, 34.75]]];
    DB::table('route_geometries')->insert([
        'route_id' => $route->id,
        'geometry' => DB::connection()->getDriverName() === 'sqlite'
            ? json_encode($line)
            : DB::raw("ST_GeomFromGeoJSON('".json_encode($line)."')"),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('stops')->insert([
        'id' => 'stop-homs-colour',
        'city_id' => 'homs',
        'name_ar' => 'موقف اللون',
        'geometry' => DB::connection()->getDriverName() === 'sqlite'
            ? json_encode(['type' => 'Point', 'coordinates' => [36.72, 34.73]])
            : DB::raw("ST_GeomFromGeoJSON('{\"type\":\"Point\",\"coordinates\":[36.72,34.73]}')"),
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    DB::table('route_stop')->insert([
        'route_id' => $route->id,
        'stop_id' => 'stop-homs-colour',
        'order' => 1,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    Cache::forget('transit:map-data:homs');

    $map = $this->getJson('/api/v1/cities/homs/map-data')->assertOk()->json();

    $routeProperties = $map['routes']['features'][0]['properties'];
    $stopProperties = $map['stops']['features'][0]['properties'];

    expect($routeProperties['colorIndex'])->toBe(3)
        ->and($routeProperties)->not->toHaveKey('color_index')
        ->and(array_keys($routeProperties))->toEqualCanonicalizing(
            ['id', 'nameAr', 'nameEn', 'colorIndex', 'priceOld', 'priceNew'],
        )
        ->and($stopProperties)->toBe([
            'id' => 'stop-homs-colour',
            'nameAr' => 'موقف اللون',
            'routeIds' => ['route-homs-colour'],
        ]);
});

test('the landing page and the studio carry the city list from the table', function () {
    if (DB::connection()->getDriverName() === 'sqlite') {
        DB::connection()->getPdo()->sqliteCreateFunction('ST_AsGeoJSON', fn ($value) => $value, 1);
    }

    seedCity('homs', ['name_ar' => 'حمص', 'name_en' => 'Homs']);
    transitRoute('route-homs-landing', 'homs');
    Cache::forget('transit:cities');

    $this->get('/transit')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Transit/Index')
            ->has('cities', 1)
            ->where('cities.0.id', 'homs')
            ->where('cities.0.nameAr', 'حمص')
            ->where('cities.0.routeCount', 1));

    $this->get('/transit/studio')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Transit/studio/Index')
            ->has('cities', 1)
            ->where('cities.0.id', 'homs'));
});
