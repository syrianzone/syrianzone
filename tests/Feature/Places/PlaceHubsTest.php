<?php

use App\Models\Place;
use App\Models\PlacePhoto;
use App\Services\IndexNow\IndexNow;
use App\Services\Places\PlaceGovernorates;
use App\Services\Sitemap\SitemapBuilder;
use App\Support\Facts;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Cache::flush();
    Http::preventStrayRequests();
});

function createHamaPlace(array $overrides = [], int $photos = 1): Place
{
    $place = Place::factory()->approved()->create(array_merge([
        'lat' => 35.1318,
        'lng' => 36.7578,
        'category' => 'historical',
        'saves_count' => 0,
    ], $overrides));

    for ($i = 0; $i < $photos; $i++) {
        PlacePhoto::factory()->create([
            'place_id' => $place->id,
            'sort' => $i,
        ]);
    }

    return $place;
}

test('governorate hub returns 200 with index, follow at >= 3 places, ordered by saves then recently approved', function () {
    $oldestMostSaved = createHamaPlace([
        'name' => 'نواعير حماة',
        'category' => 'historical',
        'saves_count' => 15,
        'approved_at' => Carbon::parse('2026-01-01 10:00:00'),
    ], photos: 3);

    $newerLessSaved = createHamaPlace([
        'name' => 'قلعة شيزر',
        'category' => 'historical',
        'saves_count' => 4,
        'approved_at' => Carbon::parse('2026-03-01 10:00:00'),
    ], photos: 1);

    $olderLessSaved = createHamaPlace([
        'name' => 'جامع النوري',
        'category' => 'religious',
        'saves_count' => 4,
        'approved_at' => Carbon::parse('2026-02-01 10:00:00'),
    ], photos: 2);

    // Non-approved places must never appear on the hub.
    Place::factory()->create([
        'name' => 'مكان بانتظار المراجعة',
        'lat' => 35.1318,
        'lng' => 36.7578,
        'status' => 'pending',
    ]);

    // Another indexable governorate (Aleppo with 3 places) and a non-indexable one (Idlib with 1 place).
    for ($i = 0; $i < 3; $i++) {
        Place::factory()->approved()->create([
            'name' => "معلم حلب {$i}",
            'lat' => 36.2021,
            'lng' => 37.1343,
        ]);
    }
    Place::factory()->approved()->create([
        'name' => 'معلم إدلب',
        'lat' => 35.9306,
        'lng' => 36.6339,
    ]);

    $response = $this->get('/mishwar/hama')->assertOk();

    $response->assertSee('أماكن سياحية في حماة', false)
        ->assertSee('name="robots" content="index, follow"', false)
        ->assertSee('rel="canonical" href="https://syrian.zone/mishwar/hama"', false)
        ->assertInertia(fn ($page) => $page
            ->component('Places/Hub')
            ->where('governorate.id', 'hama')
            ->where('governorate.name_ar', 'حماة')
            ->where('h1', 'أماكن سياحية في حماة')
            ->where('total', 3)
            ->where('mapUrl', '/mishwar')
            ->where('governorateUrl', '/governorates/hama')
            ->where('places.0.id', $oldestMostSaved->id)
            ->where('places.0.photos_count', 3)
            ->where('places.0.url', $oldestMostSaved->publicPath())
            ->where('places.1.id', $newerLessSaved->id)
            ->where('places.2.id', $olderLessSaved->id)
            ->where('categories.0.key', 'historical')
            ->where('categories.0.count', 2)
            ->where('categories.0.url', null)
            ->has('otherHubs', 1)
            ->where('otherHubs.0.id', 'aleppo'));
});

test('governorate hub renders with noindex, follow for 1 to 2 places and 404s for 0 places or unknown governorate', function () {
    $this->get('/mishwar/hama')->assertNotFound();
    $this->get('/mishwar/not-a-governorate')->assertNotFound();

    createHamaPlace(['name' => 'نواعير حماة']);

    $this->get('/mishwar/hama')
        ->assertOk()
        ->assertSee('name="robots" content="noindex, follow"', false)
        ->assertInertia(fn ($page) => $page
            ->component('Places/Hub')
            ->where('total', 1));

    createHamaPlace(['name' => 'قلعة شيزر']);

    $this->get('/mishwar/hama')
        ->assertOk()
        ->assertSee('name="robots" content="noindex, follow"', false)
        ->assertInertia(fn ($page) => $page
            ->component('Places/Hub')
            ->where('total', 2));
});

test('category hub returns 200 at >= 5 places, 302s below threshold, and 404s for other or unknown categories', function () {
    $this->get('/mishwar/hama/historical')->assertNotFound();
    $this->get('/mishwar/hama/other')->assertNotFound();
    $this->get('/mishwar/hama/unknowncat')->assertNotFound();
    $this->get('/mishwar/unknown/historical')->assertNotFound();

    for ($i = 1; $i <= 4; $i++) {
        createHamaPlace(['name' => "معلم تاريخي {$i}", 'category' => 'historical']);
    }

    // Below threshold (4 < 5): temporary 302 to the governorate hub.
    $this->get('/mishwar/hama/historical')
        ->assertRedirect('/mishwar/hama')
        ->assertStatus(302);

    // Add 5th historical place -> now meets threshold.
    createHamaPlace(['name' => 'معلم تاريخي 5', 'category' => 'historical']);

    // Add 5 `other` places -> still 404 because `other` never gets a hub.
    for ($i = 1; $i <= 5; $i++) {
        createHamaPlace(['name' => "مكان آخر {$i}", 'category' => 'other']);
    }

    $this->get('/mishwar/hama/other')->assertNotFound();

    $response = $this->get('/mishwar/hama/historical')->assertOk();
    $response->assertSee('أماكن أثرية وتاريخية في حماة', false)
        ->assertSee('name="robots" content="index, follow"', false)
        ->assertInertia(fn ($page) => $page
            ->component('Places/Hub')
            ->where('h1', 'أماكن أثرية وتاريخية في حماة')
            ->where('category.key', 'historical')
            ->where('total', 5)
            ->has('places', 5));

    // Governorate hub chip for historical now links to the category hub; `other` stays plain text (url=null).
    $this->get('/mishwar/hama')
        ->assertOk()
        ->assertInertia(function ($page) {
            $categories = collect($page->toArray()['props']['categories']);
            expect($categories->firstWhere('key', 'historical')['url'])->toBe('/mishwar/hama/historical')
                ->and($categories->firstWhere('key', 'other')['url'])->toBeNull();
        });
});

test('category hub thresholds can be lowered via config', function () {
    config(['places.min_governorate_places' => 1, 'places.min_category_places' => 2]);

    createHamaPlace(['name' => 'حديقة أم الحسن', 'category' => 'natural']);
    createHamaPlace(['name' => 'نهر العاصي', 'category' => 'natural']);

    $this->get('/mishwar/hama')
        ->assertOk()
        ->assertSee('name="robots" content="index, follow"', false);

    $this->get('/mishwar/hama/natural')
        ->assertOk()
        ->assertSee('أماكن طبيعية في حماة', false);
});

test('hub SEO metadata emits title, canonical, description, ItemList and multi-level BreadcrumbList', function () {
    $places = [];
    for ($i = 1; $i <= 5; $i++) {
        $places[] = createHamaPlace([
            'name' => "مكان حماة {$i}",
            'category' => 'historical',
            'saves_count' => 10 - $i,
        ]);
    }

    $govMeta = seoMetaFor('/mishwar/hama');
    expect($govMeta['title'])->toBe('أماكن سياحية في حماة | مشوار')
        ->and($govMeta['og_title'])->toBe('أماكن سياحية في حماة')
        ->and($govMeta['canonical'])->toBe('https://syrian.zone/mishwar/hama')
        ->and($govMeta['description'])->toContain('مكان حماة 1')
        ->and($govMeta['description'])->toContain('مكان حماة 2')
        ->and($govMeta['description'])->toContain('مكان حماة 3')
        ->and($govMeta['description'])->toContain('5 أماكن');

    $govGraph = collect(json_decode($govMeta['json_ld'], true)['@graph']);
    $govPage = $govGraph->firstWhere('@type', 'CollectionPage');
    $govBreadcrumb = $govGraph->firstWhere('@type', 'BreadcrumbList')['itemListElement'];

    expect($govPage['mainEntity']['@type'])->toBe('ItemList')
        ->and($govPage['mainEntity']['itemListElement'])->toHaveCount(5)
        ->and($govPage['mainEntity']['itemListElement'][0]['position'])->toBe(1)
        ->and($govPage['mainEntity']['itemListElement'][0]['name'])->toBe('مكان حماة 1')
        ->and($govPage['mainEntity']['itemListElement'][0]['url'])->toBe('https://syrian.zone'.$places[0]->publicPath())
        ->and($govBreadcrumb)->toHaveCount(3)
        ->and($govBreadcrumb[0]['name'])->toBe('الرئيسية')
        ->and($govBreadcrumb[1]['name'])->toBe('مشوار')
        ->and($govBreadcrumb[1]['item'])->toBe('https://syrian.zone/mishwar')
        ->and($govBreadcrumb[2]['name'])->toBe('حماة')
        ->and($govBreadcrumb[2]['item'])->toBe('https://syrian.zone/mishwar/hama');

    $catMeta = seoMetaFor('/mishwar/hama/historical');
    $catGraph = collect(json_decode($catMeta['json_ld'], true)['@graph']);
    $catBreadcrumb = $catGraph->firstWhere('@type', 'BreadcrumbList')['itemListElement'];

    expect($catMeta['title'])->toBe('أماكن أثرية وتاريخية في حماة | مشوار')
        ->and($catMeta['canonical'])->toBe('https://syrian.zone/mishwar/hama/historical')
        ->and($catBreadcrumb)->toHaveCount(4)
        ->and($catBreadcrumb[1]['item'])->toBe('https://syrian.zone/mishwar')
        ->and($catBreadcrumb[2]['item'])->toBe('https://syrian.zone/mishwar/hama')
        ->and($catBreadcrumb[3]['item'])->toBe('https://syrian.zone/mishwar/hama/historical');
});

test('placesJson hub titles cover every non-other category', function () {
    $hubTitles = Facts::placeCategoryHubTitles();
    $allCategories = Facts::placeCategories();

    expect($hubTitles)->not->toHaveKey('other');
    foreach ($allCategories as $cat) {
        if ($cat !== 'other') {
            expect($hubTitles[$cat] ?? null)->not->toBeEmpty();
        }
    }
});

test('sitemap includes only indexable Mishwar hubs with newest approved place lastmod', function () {
    // Idlib: 2 places (below gov threshold 3) -> excluded.
    for ($i = 0; $i < 2; $i++) {
        Place::factory()->approved()->create(['lat' => 35.9306, 'lng' => 36.6339, 'category' => 'historical']);
    }

    // Aleppo: 3 places, 2 historical + 1 food -> /mishwar/aleppo included, categories excluded.
    for ($i = 0; $i < 2; $i++) {
        Place::factory()->approved()->create(['lat' => 36.2021, 'lng' => 37.1343, 'category' => 'historical']);
    }
    Place::factory()->approved()->create(['lat' => 36.2021, 'lng' => 37.1343, 'category' => 'food']);

    // Hama: 5 historical places + 5 `other` places -> /mishwar/hama and /mishwar/hama/historical included; `other` excluded.
    $newestDate = Carbon::parse('2026-10-15 12:30:00');
    for ($i = 0; $i < 4; $i++) {
        createHamaPlace(['category' => 'historical', 'updated_at' => Carbon::parse('2026-09-01 00:00:00'), 'approved_at' => Carbon::parse('2026-09-01 00:00:00')]);
    }
    $newestHamaHistorical = createHamaPlace([
        'category' => 'historical',
        'updated_at' => $newestDate,
        'approved_at' => $newestDate,
    ]);
    for ($i = 0; $i < 5; $i++) {
        createHamaPlace(['category' => 'other', 'updated_at' => Carbon::parse('2026-08-01 00:00:00'), 'approved_at' => Carbon::parse('2026-08-01 00:00:00')]);
    }

    $urls = collect(app(SitemapBuilder::class)->build())->keyBy('path');

    expect($urls->has('/mishwar/aleppo'))->toBeTrue()
        ->and($urls->has('/mishwar/hama'))->toBeTrue()
        ->and($urls->has('/mishwar/hama/historical'))->toBeTrue()
        ->and($urls->has('/mishwar/hama/other'))->toBeFalse()
        ->and($urls->has('/mishwar/aleppo/historical'))->toBeFalse()
        ->and($urls->has('/mishwar/idlib'))->toBeFalse()
        ->and($urls['/mishwar/hama']->priority)->toBe(0.6)
        ->and($urls['/mishwar/hama']->changefreq)->toBe('weekly')
        ->and($urls['/mishwar/hama/historical']->priority)->toBe(0.6)
        ->and($urls['/mishwar/hama/historical']->changefreq)->toBe('weekly')
        ->and($urls['/mishwar/hama/historical']->lastmod?->toDateTimeString())->toBe($newestHamaHistorical->updated_at->toDateTimeString());
});

test('governorate show page links the Mishwar places button to /mishwar/{id} even below indexable threshold', function () {
    createHamaPlace(['name' => 'نواعير حماة']);

    $this->get('/governorates/hama')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Governorates/Show')
            ->where('places.total', 1)
            ->where('places.hub_url', '/mishwar/hama'));
});

test('llms.txt documents Mishwar governorate hubs', function () {
    $this->get('/llms.txt')
        ->assertOk()
        ->assertSee('/mishwar/{governorate}', false);
});

test('PlaceObserver queues governorate and category hubs for IndexNow and drops PlaceGovernorates cache', function () {
    app()['env'] = 'production';
    config([
        'seo.base_url' => 'https://syrian.zone',
        'seo.indexnow.enabled' => true,
        'seo.indexnow.key' => 'hub-test-key',
        'seo.indexnow.endpoint' => 'https://api.indexnow.org/indexnow',
    ]);
    Cache::forget(IndexNow::CACHE_KEY);

    $indexNow = app(IndexNow::class);

    // Prime PlaceGovernorates cache while DB is empty.
    expect(app(PlaceGovernorates::class)->map())->toBe([]);

    $place = createHamaPlace(['category' => 'natural']);

    expect($indexNow->pending())->toContain('https://syrian.zone/mishwar')
        ->toContain('https://syrian.zone/mishwar/hama')
        ->toContain('https://syrian.zone/mishwar/hama/natural')
        ->and(app(PlaceGovernorates::class)->map())->toHaveKey($place->id, 'hama');

    // `other` category does not queue a category hub.
    Cache::forget(IndexNow::CACHE_KEY);
    $otherPlace = createHamaPlace(['category' => 'other']);

    expect($indexNow->pending())->toContain('https://syrian.zone/mishwar/hama')
        ->not->toContain('https://syrian.zone/mishwar/hama/other');
});
