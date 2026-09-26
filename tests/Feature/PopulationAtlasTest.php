<?php

use App\Http\Controllers\Api\PopulationAtlasController;
use App\Models\Population\PopulationDemographic;
use App\Models\Population\PopulationEnvironmentalLog;
use App\Models\Population\PopulationRainfall;
use Illuminate\Support\Facades\Cache;

/*
|--------------------------------------------------------------------------
| PopulationAtlasController
|--------------------------------------------------------------------------
|
| Two cached read endpoints and a deliberately empty page shell. Nothing here
| writes, so the risk is not data loss but a quietly wrong payload: the master
| endpoint groups a flat demographics table two levels deep, synthesises an
| `environmental` group from a different table when one is missing, and the
| report endpoint derives two counts out of JSON columns and prints them into
| prose.
|
| Those derived counts are the part worth pinning. `drought_risk.drought_risk`
| and `air_quality.estimated_aqi` are read out of JSON blobs with data_get, so a
| shape change upstream turns them into nulls and the key findings quietly become
| "0/14 cities" rather than an error.
|
*/

/** An environmental log with the JSON shapes the report reaches into. */
function envLog(string $city, float $lat, float $lon, array $overrides = []): PopulationEnvironmentalLog
{
    return PopulationEnvironmentalLog::create(array_merge([
        'city_name' => $city,
        'lat' => $lat,
        'lon' => $lon,
        'population_ref' => 1_000_000,
        'current_conditions' => ['temperature' => 20],
        'forecast_summary' => ['summary' => 'stable'],
        'climate_trends' => ['trend' => 'warming'],
        'air_quality' => ['estimated_aqi' => 40],
        'drought_risk' => ['drought_risk' => 'Low'],
        'historical_summary' => ['note' => 'n/a'],
        'last_updated_at' => now(),
    ], $overrides));
}

// ─── Master data: grouping ─────────────────────────────────────────────────

it('groups demographics by type then source, with cities keyed by name', function () {
    PopulationDemographic::create([
        'data_type' => 'population', 'source_id' => 1, 'city_name' => 'Damascus',
        'value' => 2_500_000, 'source_url' => 'https://a.test', 'date' => '2024-01-31',
    ]);
    PopulationDemographic::create([
        'data_type' => 'population', 'source_id' => 1, 'city_name' => 'Aleppo',
        'value' => 2_100_000,
    ]);
    // A second source for the same type is a separate group, not a merge.
    PopulationDemographic::create([
        'data_type' => 'population', 'source_id' => 2, 'city_name' => 'Damascus',
        'value' => 1_900_000,
    ]);
    PopulationDemographic::create([
        'data_type' => 'literacy', 'source_id' => 1, 'city_name' => 'Damascus',
        'value' => 94,
    ]);

    $groups = $this->getJson('/api/population/master')->assertOk()->json('groups');

    expect($groups)->toHaveKeys(['population', 'literacy'])
        ->and($groups['population'])->toHaveCount(2)
        ->and($groups['literacy'])->toHaveCount(1);

    // Keyed by name, so a city appears once per source with its value.
    expect($groups['population'][0]['cities'])->toBe([
        'Damascus' => 2_500_000,
        'Aleppo' => 2_100_000,
    ])
        // and the source metadata rides on the group, taken from the first row
        ->and($groups['population'][0]['source_id'])->toBe(1)
        ->and($groups['population'][0]['source_url'])->toBe('https://a.test')
        // date is normalised to Y-m-d for the client
        ->and($groups['population'][0]['date'])->toBe('2024-01-31');
});

it('reports a null date rather than inventing one', function () {
    // The second row of a group carries no date, and the group keeps the first
    // row's — so a group whose only row has no date must serialise null, not
    // today's date or a zero epoch.
    PopulationDemographic::create([
        'data_type' => 'population', 'source_id' => 1, 'city_name' => 'Damascus',
        'value' => 1,
    ]);

    $groups = $this->getJson('/api/population/master')->assertOk()->json('groups');

    expect($groups['population'][0]['date'])->toBeNull();
});

it('groups rainfall by district code in year order', function () {
    foreach ([['SY-DI', 2023, 300.5, 290.0], ['SY-DI', 2021, 250.0, 240.0], ['SY-HI', 2022, 180.0, 175.0]] as [$pcode, $year, $rain, $avg]) {
        PopulationRainfall::create([
            'pcode' => $pcode, 'year' => $year, 'rainfall' => $rain, 'rainfall_avg' => $avg,
        ]);
    }

    $rainfall = $this->getJson('/api/population/master')->assertOk()->json('rainfall_data');

    expect($rainfall)->toHaveKeys(['SY-DI', 'SY-HI'])
        // ordered by year, so the client can draw a series without re-sorting
        ->and(array_column($rainfall['SY-DI'], 'year'))->toBe([2021, 2023])
        ->and($rainfall['SY-DI'][0]['rainfall'])->toBe(250);
});

// ─── Master data: the synthesised environmental group ──────────────────────

it('synthesises an environmental group from the log when demographics lack one', function () {
    envLog('Damascus', 33.51, 36.29);
    envLog('Aleppo', 36.20, 37.13);

    $groups = $this->getJson('/api/population/master')->assertOk()->json('groups');

    // Asserted key by key rather than as an array. The controller plucks
    // city_name with no ORDER BY, so the order is whatever the database returns
    // and is not part of the contract; a toBe() on the whole map would be a
    // different assertion on SQLite and MySQL.
    $cities = $groups['environmental'][0]['cities'];

    expect($groups['environmental'])->toHaveCount(1)
        ->and($groups['environmental'][0]['source_id'])->toBe(1)
        // presence is the signal, not a value: the map keys every logged city to 1
        ->and($cities)->toHaveCount(2)
        ->and($cities['Damascus'])->toBe(1)
        ->and($cities['Aleppo'])->toBe(1);
});

it('does not overwrite a real environmental group with the synthesised one', function () {
    PopulationDemographic::create([
        'data_type' => 'environmental', 'source_id' => 7, 'city_name' => 'Homs',
        'value' => 42,
    ]);
    envLog('Damascus', 33.51, 36.29);

    $groups = $this->getJson('/api/population/master')->assertOk()->json('groups');

    // The curated row wins. Overwriting it would replace a real source with a
    // presence-only stub carrying source_id 1.
    expect($groups['environmental'])->toHaveCount(1)
        ->and($groups['environmental'][0]['source_id'])->toBe(7)
        ->and($groups['environmental'][0]['cities'])->toBe(['Homs' => 42]);
});

it('omits the environmental group entirely when there are no logs', function () {
    PopulationDemographic::create([
        'data_type' => 'population', 'source_id' => 1, 'city_name' => 'Damascus', 'value' => 1,
    ]);

    $groups = $this->getJson('/api/population/master')->assertOk()->json('groups');

    expect($groups)->not->toHaveKey('environmental');
});

// ─── Environmental report ─────────────────────────────────────────────────

it('maps a log row into the report shape, renaming the coordinates', function () {
    envLog('Damascus', 33.51, 36.29, ['population_ref' => 2_500_000]);

    $report = $this->getJson('/api/population/env-report')->assertOk();

    $city = $report->json('cities.Damascus');

    // lat/lon in the database become latitude/longitude for the client, which is
    // the only rename in this mapping and the easiest to break silently.
    expect($city['coordinates'])->toBe(['latitude' => 33.51, 'longitude' => 36.29])
        ->and($city['population'])->toBe(2_500_000)
        // and the remaining JSON blobs are renamed, not reshaped
        ->and($city['daily_forecast_summary'])->toBe(['summary' => 'stable'])
        ->and($city['drought_risk'])->toBe(['drought_risk' => 'Low']);

    expect($report->json('metadata.country'))->toBe('Syria')
        ->and($report->json('metadata.cities_analyzed'))->toBe(1)
        ->and($report->json('summary.total_cities_analyzed'))->toBe(1);
});

it('counts cities at high drought risk from the json column', function () {
    envLog('A', 1.0, 1.0, ['drought_risk' => ['drought_risk' => 'High']]);
    envLog('B', 1.0, 1.0, ['drought_risk' => ['drought_risk' => 'Very High']]);
    envLog('C', 1.0, 1.0, ['drought_risk' => ['drought_risk' => 'Low']]);
    envLog('D', 1.0, 1.0, ['drought_risk' => ['drought_risk' => 'Moderate']]);

    $report = $this->getJson('/api/population/env-report')->assertOk();

    // High and Very High count; Moderate and Low do not. The vocabulary is
    // hardcoded in the controller, so a new upstream level is silently excluded
    // rather than reported as a change in risk.
    expect($report->json('summary.key_findings.0'))->toBe('2/4 cities at high/very high drought risk');
});

it('counts cities with poor air quality above an aqi of 75', function () {
    envLog('A', 1.0, 1.0, ['air_quality' => ['estimated_aqi' => 90]]);
    envLog('B', 1.0, 1.0, ['air_quality' => ['estimated_aqi' => 76]]);
    envLog('C', 1.0, 1.0, ['air_quality' => ['estimated_aqi' => 75]]);
    envLog('D', 1.0, 1.0, ['air_quality' => ['estimated_aqi' => 20]]);

    $report = $this->getJson('/api/population/env-report')->assertOk();

    // Strictly greater than 75, so exactly 75 is not counted.
    expect($report->json('summary.key_findings.1'))->toBe('2/4 cities with poor air quality conditions');
});

it('reports zero rather than failing when the json columns lose their keys', function () {
    // The shape the upstream data could drift into. data_get returns null, the
    // filter drops it, and the finding reads "0/1" — which is a wrong answer
    // rather than a visible failure, so it is pinned deliberately.
    envLog('A', 1.0, 1.0, [
        'drought_risk' => ['risk_level' => 'High'],
        'air_quality' => ['aqi' => 120],
    ]);

    $report = $this->getJson('/api/population/env-report')->assertOk();

    expect($report->json('summary.key_findings.0'))->toBe('0/1 cities at high/very high drought risk')
        ->and($report->json('summary.key_findings.1'))->toBe('0/1 cities with poor air quality conditions');
});

it('keeps the country-level reference data and the fixed recommendations', function () {
    envLog('A', 1.0, 1.0);

    $report = $this->getJson('/api/population/env-report')->assertOk();

    expect($report->json('country_level.world_bank_climate_data.status'))
        ->toBe('Data available via SyriaClimateService')
        ->and($report->json('country_level.climate_context.key_water_basins'))->toBeArray()
        ->and($report->json('summary.recommendations'))->toHaveCount(5)
        // the third finding is a timestamp, so only its shape is stable
        ->and($report->json('summary.key_findings'))->toHaveCount(3);
});

// ─── Caching ───────────────────────────────────────────────────────────────

it('caches the master payload and serves the second read from it', function () {
    PopulationDemographic::create([
        'data_type' => 'population', 'source_id' => 1, 'city_name' => 'Damascus', 'value' => 1,
    ]);

    $this->getJson('/api/population/master')->assertOk();

    expect(Cache::has(PopulationAtlasController::MASTER_CACHE_KEY))->toBeTrue();

    // A row added after the first read must not appear until the key is flushed,
    // which is the whole point of the hour-long cache.
    PopulationDemographic::create([
        'data_type' => 'population', 'source_id' => 1, 'city_name' => 'Aleppo', 'value' => 2,
    ]);

    $cached = $this->getJson('/api/population/master')->assertOk()->json('groups.population.0.cities');

    expect($cached)->toBe(['Damascus' => 1]);

    PopulationAtlasController::flushCache();

    $fresh = $this->getJson('/api/population/master')->assertOk()->json('groups.population.0.cities');

    expect($fresh)->toBe(['Damascus' => 1, 'Aleppo' => 2]);
});

it('caches the environmental report under its own key', function () {
    envLog('Damascus', 33.51, 36.29);

    $this->getJson('/api/population/env-report')->assertOk();

    expect(Cache::has(PopulationAtlasController::ENV_CACHE_KEY))->toBeTrue();

    // Independent of the master key: flushing both is one call, but a refresh of
    // one must not silently drop the other.
    Cache::forget(PopulationAtlasController::MASTER_CACHE_KEY);
    PopulationAtlasController::flushCache();

    expect(Cache::has(PopulationAtlasController::ENV_CACHE_KEY))->toBeFalse();
});

// ─── The page shell ────────────────────────────────────────────────────────

it('renders the atlas page without inlining the payload', function () {
    envLog('Damascus', 33.51, 36.29);
    PopulationDemographic::create([
        'data_type' => 'population', 'source_id' => 1, 'city_name' => 'Damascus', 'value' => 1,
    ]);

    // Shell only, on purpose: the full atlas is multi-hundred-KB and blocks first
    // paint on mobile, so the client fetches it from the two endpoints above. If
    // this ever starts receiving props, that decision has been undone silently.
    $this->get('/atlas')->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Population/Index')
            ->missing('groups')
            ->missing('rainfall_data')
            ->missing('cities')
        );
});
