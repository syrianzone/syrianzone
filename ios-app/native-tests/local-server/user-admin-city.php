<?php

declare(strict_types=1);

use App\Models\City;
use Illuminate\Support\Facades\DB;

function nativeFixtureUserAdminCityData(): array
{
    // Source StagingTransitSeeder::CITIES geometry, encoded as GeoJSON for SQLite.
    return [
        'id' => 'damascus', 'name_ar' => 'دمشق', 'name_en' => 'Damascus',
        'center' => json_encode(['type' => 'Point', 'coordinates' => [36.2765, 33.5138]], JSON_THROW_ON_ERROR),
        'bounds' => json_encode(['type' => 'Polygon', 'coordinates' => [[[35.8, 33.3], [36.8, 33.3], [36.8, 33.7], [35.8, 33.7], [35.8, 33.3]]]], JSON_THROW_ON_ERROR),
        'zoom' => 12, 'status' => 'active', 'created_at' => null, 'updated_at' => null,
    ];
}

function nativeFixtureUserAdminCityNeedsInsert(?array $row, bool $nameCollision): bool
{
    if ($nameCollision) {
        throw new RuntimeException('Another city owns the exact Damascus baseline name.');
    }
    if ($row === null) {
        return true;
    }
    $expected = nativeFixtureUserAdminCityData();
    ksort($row);
    ksort($expected);
    if ($row !== $expected) {
        throw new RuntimeException('The Damascus ID has different content. No city was overwritten.');
    }

    return false;
}

/** Read-only after its first insertion; never reseeds routes or permission data. */
function nativeFixtureEnsureUserAdminCity(): City
{
    $runtime = dirname(__DIR__, 2).'/.expo/local-fixture';
    if (PHP_SAPI !== 'cli' || ! app()->environment('testing') || config('app.url') !== 'https://127.0.0.1:9443'
        || DB::connection()->getDriverName() !== 'sqlite' || DB::connection()->getDatabaseName() !== $runtime.'/database.sqlite'
        || is_link($runtime.'/database.sqlite') || realpath($runtime.'/database.sqlite') !== $runtime.'/database.sqlite'
        || trim(file_get_contents($runtime.'/fixture-marker')) !== 'native-loopback-fixture-v1') {
        throw new RuntimeException('The user-administration city requires the exact isolated testing database.');
    }

    return DB::transaction(function (): City {
        $expected = nativeFixtureUserAdminCityData();
        $collision = City::whereKeyNot($expected['id'])->where(fn ($query) => $query
            ->where('name_ar', $expected['name_ar'])->orWhere('name_en', $expected['name_en']))->exists();
        $city = City::query()->whereKey($expected['id'])->lockForUpdate()->first();
        if (nativeFixtureUserAdminCityNeedsInsert($city?->getRawOriginal(), $collision)) {
            $city = new City;
            $city->timestamps = false;
            $city->forceFill($expected);
            $city->saveQuietly();
            $city->refresh();
        }
        nativeFixtureUserAdminCityNeedsInsert($city->getRawOriginal(), false);

        return $city;
    });
}
