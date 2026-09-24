<?php

use App\Models\Route;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

function seedRoutesCity(string $id = 'homs'): void
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

test('city routes list reports integer stop counts, never null', function () {
    seedRoutesCity();
    Cache::forget('transit:routes:homs');

    $route = Route::create([
        'id' => 'route-homs-test',
        'city_id' => 'homs',
        'name_ar' => 'خط اختبار',
        'status' => 'published',
    ]);

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
