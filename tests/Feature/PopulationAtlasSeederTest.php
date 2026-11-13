<?php

use App\Models\Population\PopulationDemographic;
use App\Models\Population\PopulationEnvironmentalLog;
use App\Models\Population\PopulationRainfall;
use Database\Seeders\PopulationAtlasSeeder;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Support\Facades\Artisan;

/*
|--------------------------------------------------------------------------
| PopulationAtlasSeeder
|--------------------------------------------------------------------------
|
| On a clean checkout the seeder used to find neither input file, print two
| warnings, report DONE with exit code 0 and leave the demographics and
| rainfall tables empty, so /api/population/master answered with empty groups.
|
| population.csv is now tracked, so the first test runs the seeder against the
| real file: it fails if the file is deleted or git-ignored again. The rest
| point storage_path() at a scratch directory to cover the failure modes.
|
*/

/** Runs the seeder the way `php artisan db:seed --class=...` does and returns its exit code. */
function seedPopulationAtlas(): int
{
    return Artisan::call('db:seed', ['--class' => PopulationAtlasSeeder::class, '--force' => true]);
}

/**
 * Points storage_path() at a scratch directory that holds only the given
 * seed_data files (name => contents), so a test controls which inputs exist.
 */
function useSeedData(array $files): void
{
    $dir = sys_get_temp_dir().'/atlas-seed-'.uniqid();
    $fs = new Filesystem;
    $fs->ensureDirectoryExists("{$dir}/app/seed_data");
    foreach ($files as $name => $contents) {
        $fs->put("{$dir}/app/seed_data/{$name}", $contents);
    }
    register_shutdown_function(fn () => $fs->deleteDirectory($dir));

    app()->useStoragePath($dir);
}

it('seeds a clean checkout from the tracked population.csv', function () {
    expect(seedPopulationAtlas())->toBe(0);

    expect(PopulationDemographic::count())->toBe(93)
        ->and(PopulationEnvironmentalLog::count())->toBe(14);

    $damascus = PopulationDemographic::where('data_type', 'population')
        ->where('source_id', 1)
        ->where('city_name', 'Damascus')
        ->firstOrFail();

    expect($damascus->value)->toBe(4_066_006)
        // a bare year is stored as the first of January
        ->and($damascus->date->toDateString())->toBe('2020-01-01');

    // 'unknown' means no date, not a made-up one.
    expect(PopulationDemographic::whereNull('date')->count())->toBe(13);
});

it('serves the seeded demographics from the master endpoint instead of empty groups', function () {
    seedPopulationAtlas();

    $groups = $this->getJson('/api/population/master')->assertOk()->json('groups');

    expect($groups)->toHaveKeys(['population', 'idp', 'idp_returnees']);
});

it('is idempotent: seeding twice does not duplicate rows', function () {
    seedPopulationAtlas();
    seedPopulationAtlas();

    expect(PopulationDemographic::count())->toBe(93)
        ->and(PopulationEnvironmentalLog::count())->toBe(14);
});

it('fails loudly when population.csv is missing instead of reporting success', function () {
    useSeedData([]);

    expect(fn () => seedPopulationAtlas())
        ->toThrow(RuntimeException::class, 'population.csv not found');

    expect(PopulationDemographic::count())->toBe(0);
});

it('fails loudly when population.csv is empty', function () {
    useSeedData(['population.csv' => '']);

    expect(fn () => seedPopulationAtlas())
        ->toThrow(RuntimeException::class, 'Could not read the CSV header');
});

it('fails loudly when population.csv has a header but no data rows', function () {
    useSeedData(['population.csv' => "data_type,source_id,source_url,date,note,city_name,population\n"]);

    expect(fn () => seedPopulationAtlas())
        ->toThrow(RuntimeException::class, 'no data rows');
});

it('warns and leaves rainfall empty when rainfall_yearly.json is absent', function () {
    useSeedData(['population.csv' => file_get_contents(base_path('storage/app/seed_data/population.csv'))]);

    expect(seedPopulationAtlas())->toBe(0);

    expect(Artisan::output())->toContain('rainfall_yearly.json not found')
        ->and(PopulationDemographic::count())->toBe(93)
        ->and(PopulationRainfall::count())->toBe(0);
});

it('seeds rainfall per district code and year when rainfall_yearly.json is present', function () {
    useSeedData([
        'population.csv' => file_get_contents(base_path('storage/app/seed_data/population.csv')),
        'rainfall_yearly.json' => json_encode([
            'SY01' => [
                ['year' => 2020, 'rainfall' => 120.5, 'rainfall_avg' => 110.0],
                ['year' => 2021, 'rainfall' => 95.0, 'rainfall_avg' => 110.0],
            ],
            'SY02' => [
                ['year' => 2020, 'rainfall' => 300.25, 'rainfall_avg' => 280.0],
            ],
        ]),
    ]);

    expect(seedPopulationAtlas())->toBe(0);

    expect(PopulationRainfall::count())->toBe(3)
        ->and(PopulationRainfall::where('pcode', 'SY01')->where('year', 2021)->value('rainfall'))->toBe(95.0);

    // And it is idempotent.
    seedPopulationAtlas();
    expect(PopulationRainfall::count())->toBe(3);
});

it('fails loudly when rainfall_yearly.json is a JSON array or an empty object', function (string $contents) {
    useSeedData([
        'population.csv' => file_get_contents(base_path('storage/app/seed_data/population.csv')),
        'rainfall_yearly.json' => $contents,
    ]);

    expect(fn () => seedPopulationAtlas())
        ->toThrow(RuntimeException::class, 'keyed by district code');
})->with([
    'empty array' => '[]',
    'list of years' => '[{"year": 2020, "rainfall": 1, "rainfall_avg": 1}]',
    'empty object' => '{}',
]);

it('fails loudly when rainfall_yearly.json is present but not valid JSON', function () {
    useSeedData([
        'population.csv' => file_get_contents(base_path('storage/app/seed_data/population.csv')),
        'rainfall_yearly.json' => '{not json',
    ]);

    expect(fn () => seedPopulationAtlas())
        ->toThrow(RuntimeException::class, 'Could not decode');
});
