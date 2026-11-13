<?php

use App\Models\CompassResult;
use App\Models\PlacePhoto;
use App\Models\PromiseSpeaker;
use App\Models\Route;
use App\Models\RouteDraft;
use App\Services\PlaceImageService;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

/*
|--------------------------------------------------------------------------
| Shared fixtures
|--------------------------------------------------------------------------
|
| Required from Pest.php. Each one writes a record in the shape production
| writes it, so a migration or a change to what a record is happens here once
| instead of in every test file that needs the record.
|
| Tables that have a model factory are built with it; these are the ones that
| do not (spatial seed data and Eloquent models with no factory yet).
|
*/

/**
 * Insert a city row and return its id.
 *
 * `$attributes` overrides any column. `center` is a [lng, lat] pair and `bounds`
 * is a [[minLng, minLat], [maxLng, maxLat]] corner pair, which this closes into
 * the polygon the column stores; both are handed to the driver as real geometry
 * outside SQLite, which has no spatial type and keeps the JSON as text.
 *
 * @param  array<string, mixed>  $attributes
 */
function seedCity(string $id, array $attributes = []): string
{
    $attributes += [
        'name_ar' => 'مدينة',
        'name_en' => 'City',
        'center' => [36.72, 34.73],
        'bounds' => [[36.5, 34.55], [36.95, 34.95]],
        'zoom' => 12,
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ];

    [$minLng, $minLat] = $attributes['bounds'][0];
    [$maxLng, $maxLat] = $attributes['bounds'][1];

    $attributes['center'] = spatialValue(['type' => 'Point', 'coordinates' => $attributes['center']]);
    $attributes['bounds'] = spatialValue([
        'type' => 'Polygon',
        'coordinates' => [[
            [$minLng, $minLat], [$maxLng, $minLat], [$maxLng, $maxLat], [$minLng, $maxLat], [$minLng, $minLat],
        ]],
    ]);

    DB::table('cities')->insert(['id' => $id] + $attributes);

    return $id;
}

/**
 * GeoJSON the way the connection accepts it: text on SQLite, geometry elsewhere.
 *
 * @param  array<string, mixed>  $geojson
 */
function spatialValue(array $geojson)
{
    $json = json_encode($geojson, JSON_THROW_ON_ERROR);

    if (DB::connection()->getDriverName() === 'sqlite') {
        return $json;
    }

    return DB::raw('ST_GeomFromGeoJSON('.DB::connection()->getPdo()->quote($json).')');
}

/**
 * A pending route draft, the way the transit studio writes one.
 *
 * @param  array<string, mixed>  $overrides
 */
function transitDraft(string $cityId, array $overrides = []): RouteDraft
{
    return RouteDraft::create(array_merge([
        'user_id' => null,
        'city_id' => $cityId,
        'name_ar' => 'مسودة',
        'geojson' => ['type' => 'FeatureCollection', 'features' => []],
        'status' => 'pending',
    ], $overrides));
}

/**
 * A published route on a city map.
 *
 * @param  array<string, mixed>  $overrides
 */
function transitRoute(string $id, string $cityId, array $overrides = []): Route
{
    return Route::create(array_merge([
        'id' => $id,
        'city_id' => $cityId,
        'name_ar' => 'خط',
        'status' => 'published',
    ], $overrides));
}

/**
 * Store an image through the service the upload endpoints use.
 */
function placePhoto(int $placeId, int $sort = 0, string $name = 'a.jpg'): PlacePhoto
{
    return app(PlaceImageService::class)->store(
        UploadedFile::fake()->image($name, 800, 600),
        $placeId,
        $sort,
    );
}

/**
 * The page metadata one request resolves, without going through HTTP.
 *
 * @return array<string, mixed>
 */
function seoMetaFor(string $uri): array
{
    return SeoMeta::resolve(Request::create($uri, 'GET'));
}

/**
 * One Photon geocoder hit, the shape app/Http/Controllers/Api/V1/PoiSearchController
 * normalizes.
 *
 * @return array<string, mixed>
 */
function photonFeature(string $name, string $osmValue, float $lng, float $lat): array
{
    return [
        'type' => 'Feature',
        'geometry' => ['type' => 'Point', 'coordinates' => [$lng, $lat]],
        'properties' => ['name' => $name, 'osm_value' => $osmValue, 'city' => 'دمشق'],
    ];
}

/**
 * One compass run, anonymous and counted in the public statistics unless
 * overridden.
 *
 * @param  array<string, mixed>  $overrides
 */
function compassRun(array $overrides = []): CompassResult
{
    return CompassResult::create(array_merge([
        'user_id' => null,
        'version' => 'short',
        'answers' => ['auth_lib#0' => 2],
        'scores' => ['auth_lib' => 0.5],
        'align' => ['west' => 1],
        'spectrum' => 'tech_reform',
        'consistency' => 0.5,
        'answered' => 1,
        'stats_consent' => true,
    ], $overrides));
}

/**
 * A promise as the admin and agent create endpoints accept it.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function promisePayload(array $overrides = []): array
{
    $speaker = PromiseSpeaker::factory()->create();

    return array_merge([
        'speaker_ref' => 'speaker:'.$speaker->id,
        'title' => 'إعادة تأهيل المحطة',
        'quote' => 'سنعيد تأهيل المحطة خلال ستة أشهر',
        'statement_date' => '2025-07-01',
        'statement_venue' => 'tv_interview',
        'deadline_wording' => 'خلال ستة أشهر',
        'deadline_date' => '2026-01-01',
        'sector_id' => 'electricity',
        'is_national' => false,
        'governorates' => ['aleppo', 'homs'],
        'tags' => ['#الكهرباء', 'محطات'],
        'sources' => [
            ['url' => 'https://example.com/a', 'type' => 'tv_interview', 'published_date' => '2025-07-01'],
            ['url' => 'https://example.com/b', 'type' => 'news_article', 'published_date' => '2025-07-03'],
        ],
    ], $overrides);
}
