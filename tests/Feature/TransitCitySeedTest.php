<?php

use App\Services\Transit\TransitCache;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * `resources/js/Domain/transit/cities.json` is the city **seed** list: the input
 * `transit:import-geojson` writes the `cities` table from, and the synchronous
 * index the global search reads. It is not a runtime copy of the table — the
 * live city payload (with its published-route count) comes from `GET
 * /api/v1/cities` — so a derived field must never creep back into it.
 */
function citySeedRows(): array
{
    return json_decode(file_get_contents(resource_path('js/Domain/transit/cities.json')), true, 512, JSON_THROW_ON_ERROR);
}

test('the city seed file carries seed columns only', function () {
    $rows = citySeedRows();

    expect($rows)->toBeArray()->not->toBeEmpty();

    foreach ($rows as $row) {
        expect(array_keys($row))->toEqualCanonicalizing([
            'id', 'nameAr', 'nameEn', 'status', 'center', 'bounds', 'zoom',
        ])
            ->and($row['id'])->toBeString()->not->toBe('')
            ->and($row['nameAr'])->toBeString()->not->toBe('')
            ->and($row['status'])->toBeIn(['active', 'coming_soon'])
            ->and($row['center'])->toHaveCount(2)
            ->and($row['bounds'])->toHaveCount(2);
    }

    expect(array_column($rows, 'id'))->toBe(array_values(array_unique(array_column($rows, 'id'))));
});

test('the api serves each seeded city as declared, with a live route count', function () {
    if (DB::connection()->getDriverName() === 'sqlite') {
        DB::connection()->getPdo()->sqliteCreateFunction('ST_AsGeoJSON', fn ($value) => $value, 1);
    }

    $rows = citySeedRows();

    foreach ($rows as $row) {
        seedCity($row['id'], [
            'name_ar' => $row['nameAr'],
            'name_en' => $row['nameEn'],
            'status' => $row['status'],
            'center' => $row['center'],
            'bounds' => $row['bounds'],
            'zoom' => $row['zoom'],
        ]);
    }

    // A published route changes the answer the API gives, and the seed file has
    // no field to go stale: the count is the table's.
    transitRoute('route-damascus-seed', 'damascus', ['name_ar' => 'خط البذرة']);
    Cache::forget(TransitCache::CITIES_API);

    $api = collect($this->getJson('/api/v1/cities')->assertOk()->json())->keyBy('id');

    expect($api)->toHaveCount(count($rows));

    foreach ($rows as $row) {
        $city = $api->get($row['id']);

        expect($city)->not->toBeNull()
            ->and($city['nameAr'])->toBe($row['nameAr'])
            ->and($city['nameEn'])->toBe($row['nameEn'])
            ->and($city['status'])->toBe($row['status'])
            ->and((int) $city['zoom'])->toBe((int) $row['zoom'])
            ->and(array_map('floatval', $city['center']))->toEqual(array_map('floatval', $row['center']))
            ->and($city['bounds'])->toEqual($row['bounds']);
    }

    expect($api->get('damascus')['routeCount'])->toBe(1)
        ->and($api->get('aleppo')['routeCount'])->toBe(0);
});
