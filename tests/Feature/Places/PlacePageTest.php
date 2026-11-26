<?php

use App\Models\Place;
use App\Models\PlacePhoto;
use App\Services\Governorates\GovernorateGeometry;
use App\Services\IndexNow\IndexNow;
use App\Services\Places\PlaceGovernorates;
use App\Services\Places\PlaceIndexability;
use App\Services\Places\PlaceModerationService;
use App\Services\Sitemap\ImageSitemapBuilder;
use App\Services\Sitemap\SitemapBuilder;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\Previews;
use App\Support\Seo\Preview\Resolvers\PlacePreview;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

const DAMASCUS_LAT = 33.5119;
const DAMASCUS_LNG = 36.3065;

const RICH_DESCRIPTION = 'الجامع الأموي الكبير في قلب دمشق القديمة من أقدم وأعرق المساجد التاريخية في العالم الإسلامي ويضم صحناً واسعاً وفسيفساء أثرية نادرة ومآذن ثلاث شهيرة.';
const SHORT_DESCRIPTION = 'مكان جميل وسط المدينة القديمة.';

function enableIndexNowForPlacesTest(): IndexNow
{
    app()['env'] = 'production';
    config([
        'seo.base_url' => 'https://syrian.zone',
        'seo.indexnow.enabled' => true,
        'seo.indexnow.key' => 'places-observer-key',
        'seo.indexnow.endpoint' => 'https://api.indexnow.org/indexnow',
    ]);
    Cache::forget(IndexNow::CACHE_KEY);

    return app(IndexNow::class);
}

beforeEach(function () {
    Cache::flush();
});

test('approved place page returns 200 with name, description, photos, governorate, locator and nearby places', function () {
    $place = Place::factory()->approved()->create([
        'name' => 'الجامع الأموي الكبير',
        'category' => 'religious',
        'description' => RICH_DESCRIPTION,
        'lat' => DAMASCUS_LAT,
        'lng' => DAMASCUS_LNG,
    ]);
    PlacePhoto::factory()->create(['place_id' => $place->id, 'sort' => 0, 'display_path' => "places/{$place->id}/1_display.webp"]);
    PlacePhoto::factory()->create(['place_id' => $place->id, 'sort' => 1, 'display_path' => "places/{$place->id}/2_display.webp"]);

    $nearApproved = Place::factory()->approved()->create([
        'name' => 'سوق الحميدية',
        'category' => 'market',
        'lat' => 33.5110,
        'lng' => 36.3020,
    ]);
    PlacePhoto::factory()->create(['place_id' => $nearApproved->id, 'sort' => 0]);

    // Pending place nearby must NOT appear in nearby list
    Place::factory()->create([
        'name' => 'مكان قيد المراجعة',
        'status' => 'pending',
        'lat' => 33.5115,
        'lng' => 36.3050,
    ]);

    // Far approved place (> 15 km away, Aleppo) must NOT appear in nearby list
    Place::factory()->approved()->create([
        'name' => 'قلعة حلب',
        'lat' => 36.1992,
        'lng' => 37.1626,
    ]);

    $response = $this->get($place->publicPath())->assertOk();

    $response->assertInertia(fn ($page) => $page
        ->component('Places/Show')
        ->where('place.id', $place->id)
        ->where('place.name', 'الجامع الأموي الكبير')
        ->where('place.description', RICH_DESCRIPTION)
        ->where('place.url', $place->publicPath())
        ->has('place.photos', 2)
        ->where('governorate.id', 'damascus')
        ->where('governorate.name_ar', 'دمشق')
        ->where('isThin', false)
        ->has('locator.shapes', 14)
        ->where('locator.viewBox', fn ($vb) => is_string($vb) && $vb !== $page->toArray()['props']['locator']['fullViewBox'])
        ->where('locator.fullViewBox', fn ($vb) => is_string($vb) && str_starts_with($vb, '0 0 '))
        ->where('locator.shapes.0.label_x', fn ($x) => is_numeric($x))
        ->where('locator.shapes.0.label_y', fn ($y) => is_numeric($y))
        ->where('locator.pin.x', fn ($x) => is_numeric($x))
        ->where('locator.pin.y', fn ($y) => is_numeric($y))
        ->has('nearby', 1)
        ->where('nearby.0.id', $nearApproved->id)
        ->where('nearby.0.url', $nearApproved->publicPath()));
});

test('pending, rejected and unknown places return 404', function () {
    $pending = Place::factory()->create(['name' => 'مكان معلق', 'status' => 'pending']);
    $rejected = Place::factory()->rejected()->create(['name' => 'مكان مرفوض']);

    $this->get($pending->publicPath())->assertNotFound();
    $this->get('/mishwar/'.$pending->id)->assertNotFound();
    $this->get($rejected->publicPath())->assertNotFound();
    $this->get('/mishwar/'.$rejected->id)->assertNotFound();
    $this->get('/mishwar/999999')->assertNotFound();
    $this->get('/mishwar/999999-nonexistent')->assertNotFound();
});

test('non-canonical id, wrong slug and old slug after rename 301 to canonical publicPath while keeping query string', function () {
    $place = Place::factory()->approved()->create([
        'name' => 'الاسم القديم للمكان',
        'description' => RICH_DESCRIPTION,
        'lat' => DAMASCUS_LAT,
        'lng' => DAMASCUS_LNG,
    ]);
    $oldPath = $place->publicPath();

    // Bare id -> 301
    $this->get('/mishwar/'.$place->id)
        ->assertStatus(301)
        ->assertRedirect($oldPath);

    // Bare id with query string -> preserves query string
    $this->get('/mishwar/'.$place->id.'?ref=map&utm_source=share')
        ->assertStatus(301)
        ->assertRedirect($oldPath.'?ref=map&utm_source=share');

    // Wrong slug -> 301
    $this->get('/mishwar/'.$place->id.'-wrong-slug?a=1')
        ->assertStatus(301)
        ->assertRedirect($oldPath.'?a=1');

    // Rename place -> old slug 301s to new canonical path
    $place->update(['name' => 'الجامع الأموي الكبير']);
    $newPath = $place->fresh()->publicPath();
    expect($newPath)->not->toBe($oldPath);

    $this->get($oldPath)
        ->assertStatus(301)
        ->assertRedirect($newPath);

    $this->get($newPath)->assertOk();
});

test('place SEO emits canonical, title without site suffix doubling, og:type article, robots for indexable vs thin, and 3-level breadcrumb JSON-LD', function () {
    $rich = Place::factory()->approved()->create([
        'name' => 'الجامع الأموي الكبير',
        'category' => 'religious',
        'description' => RICH_DESCRIPTION,
        'lat' => DAMASCUS_LAT,
        'lng' => DAMASCUS_LNG,
    ]);
    for ($i = 0; $i < 6; $i++) {
        PlacePhoto::factory()->create(['place_id' => $rich->id, 'sort' => $i, 'display_path' => "places/{$rich->id}/{$i}_display.webp"]);
    }

    $base = rtrim((string) config('seo.base_url'), '/');
    $meta = seoMetaFor($rich->publicPath());
    $card = Previews::cardSource('place')->card((string) $rich->id);

    expect($meta['title'])->toBe('الجامع الأموي الكبير في دمشق — صور وموقع | مشوار')
        ->and($meta['title'])->not->toContain('Syrian Zone')
        ->and($meta['og_title'])->toBe('الجامع الأموي الكبير')
        ->and($meta['type'])->toBe('article')
        ->and($meta['canonical'])->toBe($base.$rich->publicPath())
        ->and($meta['url'])->toBe($base.$rich->publicPath())
        ->and($meta['image'])->toBe($base.'/og/r/place/'.$rich->id.'.jpg?v='.$card->version())
        ->and($meta['robots'])->toBe('index, follow');

    $graph = collect(json_decode($meta['json_ld'], true)['@graph']);
    $webPage = $graph->firstWhere('@type', 'WebPage');
    $entity = $webPage['mainEntity'];

    expect($entity['@type'])->toBe(['TouristAttraction', 'PlaceOfWorship'])
        ->and($entity['name'])->toBe('الجامع الأموي الكبير')
        ->and($entity['url'])->toBe($base.$rich->publicPath())
        ->and($entity['image'])->toHaveCount(5)
        ->and($entity['geo'])->toBe([
            '@type' => 'GeoCoordinates',
            'latitude' => DAMASCUS_LAT,
            'longitude' => DAMASCUS_LNG,
        ])
        ->and($entity['address'])->toBe([
            '@type' => 'PostalAddress',
            'addressRegion' => 'دمشق',
            'addressCountry' => 'SY',
        ])
        ->and($entity['hasMap'])->toBe('https://www.google.com/maps/search/?api=1&query='.DAMASCUS_LAT.','.DAMASCUS_LNG)
        ->and($entity)->not->toHaveKey('aggregateRating');

    foreach ($entity['image'] as $imgUrl) {
        expect($imgUrl)->toMatch('#^https?://#');
    }

    // BreadcrumbList: الرئيسية -> مشوار -> دمشق -> place
    $breadcrumb = $graph->firstWhere('@type', 'BreadcrumbList')['itemListElement'];
    expect($breadcrumb)->toHaveCount(4)
        ->and($breadcrumb[0])->toMatchArray(['position' => 1, 'name' => 'الرئيسية', 'item' => $base.'/'])
        ->and($breadcrumb[1])->toMatchArray(['position' => 2, 'name' => 'مشوار', 'item' => $base.'/mishwar'])
        ->and($breadcrumb[2])->toMatchArray(['position' => 3, 'name' => 'دمشق', 'item' => $base.'/mishwar/damascus'])
        ->and($breadcrumb[3])->toMatchArray(['position' => 4, 'name' => 'الجامع الأموي الكبير', 'item' => $base.$rich->publicPath()]);

    // Thin place (<15 words AND <=1 photo): renders 200 but carries noindex, follow
    $thin = Place::factory()->approved()->create([
        'name' => 'مكان مختصر',
        'category' => 'other',
        'description' => SHORT_DESCRIPTION,
        'lat' => DAMASCUS_LAT,
        'lng' => DAMASCUS_LNG,
    ]);
    PlacePhoto::factory()->create(['place_id' => $thin->id, 'sort' => 0]);

    expect(PlaceIndexability::isThin($thin->fresh('photos')))->toBeTrue()
        ->and(seoMetaFor($thin->publicPath())['robots'])->toBe('noindex, follow');

    $this->get($thin->publicPath())
        ->assertOk()
        ->assertSee('name="robots" content="noindex, follow"', false)
        ->assertInertia(fn ($page) => $page->where('isThin', true));

    // Short description with 2 photos is NOT thin -> index, follow
    PlacePhoto::factory()->create(['place_id' => $thin->id, 'sort' => 1]);
    expect(PlaceIndexability::isThin($thin->fresh('photos')))->toBeFalse()
        ->and(seoMetaFor($thin->publicPath())['robots'])->toBe('index, follow');
});

test('JSON-LD mainEntity @type maps every Mishwar category as specified', function () {
    $expected = [
        'historical' => ['TouristAttraction', 'LandmarksOrHistoricalBuildings'],
        'religious' => ['TouristAttraction', 'PlaceOfWorship'],
        'food' => 'FoodEstablishment',
        'natural' => 'TouristAttraction',
        'viewpoint' => 'TouristAttraction',
        'cultural' => 'TouristAttraction',
        'market' => 'TouristAttraction',
        'abandoned' => 'TouristAttraction',
        'other' => 'Place',
    ];

    foreach ($expected as $category => $schemaType) {
        $place = Place::factory()->approved()->create([
            'name' => 'معلم '.$category,
            'category' => $category,
            'description' => RICH_DESCRIPTION,
            'lat' => DAMASCUS_LAT,
            'lng' => DAMASCUS_LNG,
        ]);

        $meta = seoMetaFor($place->publicPath());
        $graph = collect(json_decode($meta['json_ld'], true)['@graph']);
        $webPage = $graph->firstWhere('@type', 'WebPage');

        expect($webPage['mainEntity']['@type'], $category)->toBe($schemaType)
            ->and(PlacePreview::schemaTypeForCategory($category))->toBe($schemaType);
    }
});

test('Preview supports multi-level parents while keeping single parent callers working', function () {
    $base = rtrim((string) config('seo.base_url'), '/');

    // Existing single-parent page (e.g. /promises) keeps working
    $promiseMeta = SeoMeta::resolve(Request::create('/muslim/quran', 'GET'));
    $promiseCrumb = collect(json_decode($promiseMeta['json_ld'], true)['@graph'])
        ->firstWhere('@type', 'BreadcrumbList')['itemListElement'];
    expect($promiseCrumb)->toHaveCount(3)
        ->and($promiseCrumb[1]['item'])->toBe($base.'/muslim');

    // Preview DTO accepts optional parents list directly
    $preview = new Preview(
        title: 'اختبار',
        description: 'وصف اختبار',
        canonicalPath: '/mishwar/1-test',
        image: '/og/mishwar.png',
        parents: [['/mishwar', 'مشوار'], ['/mishwar/damascus', 'دمشق']],
    );
    expect($preview->parents)->toBe([['/mishwar', 'مشوار'], ['/mishwar/damascus', 'دمشق']]);
});

test('sitemap and image sitemap include indexable places with latest lastmod and exclude thin and non-approved places', function () {
    $olderTime = Carbon::parse('2026-06-01 10:00:00');
    $photoTime = Carbon::parse('2026-08-15 12:30:00');

    $indexable = Place::factory()->approved()->create([
        'name' => 'قلعة حلب الأثرية',
        'description' => RICH_DESCRIPTION,
        'updated_at' => $olderTime,
    ]);
    $photo = PlacePhoto::factory()->create([
        'place_id' => $indexable->id,
        'display_path' => "places/{$indexable->id}/hero_display.webp",
        'updated_at' => $photoTime,
    ]);

    $thin = Place::factory()->approved()->create([
        'name' => 'مكان مختصر',
        'description' => SHORT_DESCRIPTION,
    ]);
    PlacePhoto::factory()->create(['place_id' => $thin->id]);

    $pending = Place::factory()->create([
        'name' => 'مكان معلق',
        'description' => RICH_DESCRIPTION,
        'status' => 'pending',
    ]);
    PlacePhoto::factory()->create(['place_id' => $pending->id]);

    $rejected = Place::factory()->rejected()->create([
        'name' => 'مكان مرفوض',
        'description' => RICH_DESCRIPTION,
    ]);
    PlacePhoto::factory()->create(['place_id' => $rejected->id]);

    // SitemapBuilder
    $sitemapUrls = collect(app(SitemapBuilder::class)->build())->keyBy('path');
    expect($sitemapUrls->has($indexable->publicPath()))->toBeTrue()
        ->and($sitemapUrls[$indexable->publicPath()]->priority)->toBe(0.6)
        ->and($sitemapUrls[$indexable->publicPath()]->changefreq)->toBe('monthly')
        ->and($sitemapUrls[$indexable->publicPath()]->lastmod?->toAtomString())->toBe($photoTime->toAtomString())
        ->and($sitemapUrls->has($thin->publicPath()))->toBeFalse()
        ->and($sitemapUrls->has($pending->publicPath()))->toBeFalse()
        ->and($sitemapUrls->has($rejected->publicPath()))->toBeFalse();

    // Rendered /sitemap.xml must not double-encode percent-encoded Arabic slugs
    $xml = $this->get('/sitemap.xml')->assertOk()->getContent();
    $base = rtrim((string) config('seo.base_url'), '/');
    expect($xml)->toContain('<loc>'.$base.$indexable->publicPath().'</loc>')
        ->and($xml)->not->toContain('%25');

    // ImageSitemapBuilder
    $imageEntries = collect(app(ImageSitemapBuilder::class)->build())->keyBy('path');
    expect($imageEntries->has($indexable->publicPath()))->toBeTrue()
        ->and($imageEntries[$indexable->publicPath()]->images)->toHaveCount(1)
        ->and($imageEntries[$indexable->publicPath()]->images[0])->toMatch('#^https?://#')
        ->and($imageEntries[$indexable->publicPath()]->images[0])->toContain("places/{$indexable->id}/hero_display.webp")
        ->and($imageEntries->has($thin->publicPath()))->toBeFalse()
        ->and($imageEntries->has($pending->publicPath()))->toBeFalse()
        ->and($imageEntries->has($rejected->publicPath()))->toBeFalse();
});

const OFFSHORE_LAT = 34.5;
const OFFSHORE_LNG = 33.0;

test('place and photo observers queue canonical paths, old slug on rename, and skip non-approved places', function () {
    $indexNow = enableIndexNowForPlacesTest();
    $base = 'https://syrian.zone';

    // Pending place + photo -> queues nothing
    $place = Place::factory()->create([
        'name' => 'قصر العظم',
        'description' => RICH_DESCRIPTION,
        'status' => 'pending',
        // Off the coast, outside every governorate: hub paths are covered in
        // IndexNowTest; this test pins the place-page paths only.
        'lat' => OFFSHORE_LAT,
        'lng' => OFFSHORE_LNG,
    ]);
    $photo1 = PlacePhoto::factory()->create(['place_id' => $place->id]);
    expect($indexNow->pending())->toBe([]);

    // Approving indexable place -> queues place page + /mishwar
    $place->update(['status' => 'approved', 'approved_at' => now()]);
    $firstPath = $place->publicPath();
    expect($indexNow->pending())->toBe([
        $base.$firstPath,
        $base.'/mishwar',
    ]);

    // Renaming approved indexable place -> queues new path, old path, and /mishwar
    Cache::forget(IndexNow::CACHE_KEY);
    $place->update(['name' => 'قصر العظم التاريخي']);
    $renamedPath = $place->fresh()->publicPath();
    expect($renamedPath)->not->toBe($firstPath)
        ->and($indexNow->pending())->toBe([
            $base.$renamedPath,
            $base.$firstPath,
            $base.'/mishwar',
        ]);

    // Adding a photo to an approved indexable place -> queues place page
    Cache::forget(IndexNow::CACHE_KEY);
    $photo2 = PlacePhoto::factory()->create(['place_id' => $place->id, 'sort' => 1]);
    expect($indexNow->pending())->toBe([$base.$renamedPath]);

    // Deleting a photo from an approved indexable place -> queues place page
    Cache::forget(IndexNow::CACHE_KEY);
    $photo2->delete();
    expect($indexNow->pending())->toBe([$base.$renamedPath]);

    // Deleting an approved indexable place -> queues place page + /mishwar
    Cache::forget(IndexNow::CACHE_KEY);
    $place->delete();
    expect($indexNow->pending())->toBe([
        $base.$renamedPath,
        $base.'/mishwar',
    ]);

    // Thin approved place gaining a 2nd photo becomes indexable -> queues place page
    Cache::forget(IndexNow::CACHE_KEY);
    $thin = Place::factory()->approved()->create([
        'name' => 'حمام نور الدين',
        'description' => SHORT_DESCRIPTION,
        'lat' => OFFSHORE_LAT,
        'lng' => OFFSHORE_LNG,
    ]);
    expect($indexNow->pending())->toBe([$base.'/mishwar']);

    Cache::forget(IndexNow::CACHE_KEY);
    $p1 = PlacePhoto::factory()->create(['place_id' => $thin->id, 'sort' => 0]);
    expect($indexNow->pending())->toBe([]);

    $p2 = PlacePhoto::factory()->create(['place_id' => $thin->id, 'sort' => 1]);
    expect($indexNow->pending())->toBe([$base.$thin->publicPath()]);

    // Dropping back to 1 photo (thin again) queues place page so crawlers see noindex
    Cache::forget(IndexNow::CACHE_KEY);
    $p2->delete();
    expect($indexNow->pending())->toBe([$base.$thin->publicPath()]);
});

test('forgetting map cache also forgets PlaceGovernorates cache', function () {
    $place = Place::factory()->approved()->create([
        'name' => 'سوق الحميدية',
        'lat' => DAMASCUS_LAT,
        'lng' => DAMASCUS_LNG,
    ]);

    $govs = app(PlaceGovernorates::class);
    expect($govs->map())->toHaveKey($place->id)
        ->and(Cache::has(PlaceGovernorates::CACHE_KEY))->toBeTrue();

    PlaceModerationService::forgetMapCache();

    expect(Cache::has(PlaceGovernorates::CACHE_KEY))->toBeFalse();
});

test('locatorForPlace zooms tightly for Damascus while keeping Rural Damascus label in view and large governorates broad', function () {
    $geom = app(GovernorateGeometry::class);

    $damascus = $geom->locatorForPlace(DAMASCUS_LAT, DAMASCUS_LNG, 'damascus');
    $homs = $geom->locatorForPlace(34.7397, 36.6751, 'homs');
    $quneitra = $geom->locatorForPlace(33.1287, 35.8598, 'quneitra');

    expect($damascus)->not->toBeNull()
        ->and($homs)->not->toBeNull()
        ->and($quneitra)->not->toBeNull();

    [$dx, $dy, $dw, $dh] = array_map('floatval', explode(' ', $damascus['viewBox']));
    [, , $hw] = array_map('floatval', explode(' ', $homs['viewBox']));
    [, , $qw] = array_map('floatval', explode(' ', $quneitra['viewBox']));

    // Damascus viewBox span is much smaller than Homs's and Quneitra's
    expect($dw)->toBeLessThan(45.0)
        ->and($dw)->toBeGreaterThan(22.0)
        ->and($dw)->toBeLessThan($qw)
        ->and($dw)->toBeLessThan($hw)
        ->and($hw)->toBeGreaterThan(400.0);

    // Rural Damascus label is placed inside the Damascus zoomed viewBox and clear of the pin
    $rural = collect($damascus['shapes'])->firstWhere('id', 'rural-damascus');
    expect($rural)->not->toBeNull()
        ->and($rural['label_x'])->toBeGreaterThan($dx)
        ->and($rural['label_x'])->toBeLessThan($dx + $dw)
        ->and($rural['label_y'])->toBeGreaterThan($dy)
        ->and($rural['label_y'])->toBeLessThan($dy + $dh);

    $unitScale = $dw / 300.0;
    $pinDist = hypot($rural['label_x'] - $damascus['pin']['x'], $rural['label_y'] - $damascus['pin']['y']);
    expect($pinDist)->toBeGreaterThan(15.0 * $unitScale);
});
