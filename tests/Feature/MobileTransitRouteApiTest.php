<?php

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

function mobileTransitGeometry(array $geometry): mixed
{
    $json = json_encode($geometry, JSON_THROW_ON_ERROR);
    if (DB::connection()->getDriverName() === 'sqlite') {
        return $json;
    }

    $quoted = DB::connection()->getPdo()->quote($json);

    return DB::raw("ST_GeomFromGeoJSON({$quoted})");
}

beforeEach(function () {
    Cache::flush();

    $routes = base_path('routes/mobile-public.php');
    if (is_file($routes) && ! Route::has('mobile.public.home')) {
        Route::middleware('api')->prefix('api')->group($routes);
    }
});

test('transit route detail returns published route stops in travel order', function () {
    DB::table('cities')->insert([
        'id' => 'damascus',
        'name_ar' => 'دمشق',
        'name_en' => 'Damascus',
        'center' => mobileTransitGeometry(['type' => 'Point', 'coordinates' => [36.29, 33.51]]),
        'bounds' => mobileTransitGeometry([
            'type' => 'Polygon',
            'coordinates' => [[[35.8, 33.3], [36.8, 33.3], [36.8, 33.7], [35.8, 33.3]]],
        ]),
        'zoom' => 12,
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('routes')->insert([
        'id' => 'route-1',
        'city_id' => 'damascus',
        'name_ar' => 'الخط الأول',
        'name_en' => 'Route one',
        'color_index' => 3,
        'price_old' => 1000,
        'price_new' => 2000,
        'status' => 'published',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('stops')->insert([
        [
            'id' => 'stop-a',
            'city_id' => 'damascus',
            'name_ar' => 'المحطة أ',
            'name_en' => 'Stop A',
            'geometry' => mobileTransitGeometry(['type' => 'Point', 'coordinates' => [36.3, 33.5]]),
            'created_at' => now(),
            'updated_at' => now(),
        ],
        [
            'id' => 'stop-b',
            'city_id' => 'damascus',
            'name_ar' => 'المحطة ب',
            'name_en' => 'Stop B',
            'geometry' => mobileTransitGeometry(['type' => 'Point', 'coordinates' => [36.4, 33.6]]),
            'created_at' => now(),
            'updated_at' => now(),
        ],
    ]);

    DB::table('route_stop')->insert([
        [
            'route_id' => 'route-1',
            'stop_id' => 'stop-a',
            'order' => 2,
            'created_at' => now(),
            'updated_at' => now(),
        ],
        [
            'route_id' => 'route-1',
            'stop_id' => 'stop-b',
            'order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ],
    ]);

    $this->getJson('/api/mobile/transit/cities/damascus/routes/route-1')
        ->assertOk()
        ->assertJsonPath('data.id', 'damascus')
        ->assertJsonPath('data.city.nameEn', 'Damascus')
        ->assertJsonPath('data.route.id', 'route-1')
        ->assertJsonPath('data.route.colorIndex', 3)
        ->assertJsonPath('data.stops.0.properties.id', 'stop-b')
        ->assertJsonPath('data.stops.0.properties.nameEn', 'Stop B')
        ->assertJsonPath('data.stops.0.coordinates', [36.4, 33.6])
        ->assertJsonPath('data.stops.1.properties.id', 'stop-a')
        ->assertJsonPath('data.stops.1.properties.nameEn', 'Stop A');
});

test('unknown transit routes return a JSON 404', function () {
    $this->getJson('/api/mobile/transit/cities/damascus/routes/missing')
        ->assertNotFound()
        ->assertExactJson(['message' => 'Transit route not found.']);
});
