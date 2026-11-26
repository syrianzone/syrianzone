<?php

use App\Models\City;
use App\Models\GovtOfficial;
use App\Models\GovtTenure;
use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use App\Models\Place;
use App\Models\Population\PopulationDemographic;
use App\Models\Route as TransitRoute;
use App\Services\Governorates\GovernorateDataService;
use App\Services\Sitemap\ImageSitemapBuilder;
use App\Services\Sitemap\SitemapBuilder;
use App\Support\Facts;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Cache::flush();
    Http::preventStrayRequests();
});

function fakeAladhanSuccess(): void
{
    Http::fake([
        '*' => Http::response([
            'code' => 200,
            'data' => [
                'timings' => [
                    'Fajr' => '05:15',
                    'Sunrise' => '06:42',
                    'Dhuhr' => '12:20',
                    'Asr' => '15:25',
                    'Maghrib' => '17:58',
                    'Isha' => '19:20',
                ],
                'date' => [
                    'hijri' => [
                        'day' => '15',
                        'month' => ['ar' => 'جمادى الآخرة'],
                        'year' => '1448',
                    ],
                ],
            ],
        ], 200),
    ]);
}

function fakeAladhanFailure(): void
{
    Http::fake([
        '*' => Http::response([], 503),
    ]);
}

test('governorates hub renders 200 with all 14 governorates, svg map, and SEO metadata', function () {
    $response = $this->get('/governorates')->assertOk();

    $response->assertSee('محافظات سوريا الـ14', false)
        ->assertSee('rel="canonical" href="'.rtrim((string) config('seo.base_url'), '/').'/governorates"', false)
        ->assertInertia(fn ($page) => $page
            ->component('Governorates/Index')
            ->has('governorates', 14)
            ->has('svgMap.shapes', 14));
});

test('every governorate id returns 200 with a unique title, canonical, and AdministrativeArea JSON-LD', function () {
    fakeAladhanFailure();

    $titles = [];
    $descriptions = [];
    $base = rtrim((string) config('seo.base_url'), '/');

    foreach (Facts::governorates() as $gov) {
        $id = (string) $gov['id'];
        $response = $this->get('/governorates/'.$id)->assertOk();
        $html = $response->getContent();

        expect(preg_match('#<title[^>]*>(.*?)</title>#s', $html, $titleMatch))->toBe(1);
        expect(preg_match('#<meta[^>]*name="description"[^>]*content="([^"]+)"#', $html, $descMatch))->toBe(1);

        $titles[] = $titleMatch[1];
        $descriptions[] = $descMatch[1];

        $response->assertSee('rel="canonical" href="'.$base.'/governorates/'.$id.'"', false)
            ->assertSee('AdministrativeArea', false)
            ->assertSee('BreadcrumbList', false)
            ->assertSee('الجمهورية العربية السورية', false)
            ->assertInertia(fn ($page) => $page
                ->component('Governorates/Show')
                ->where('governorate.id', $id)
                ->has('otherGovernorates', 13));
    }

    expect(count(array_unique($titles)))->toBe(14)
        ->and(count(array_unique($descriptions)))->toBe(14);
});

test('unknown governorate id returns 404', function () {
    $this->get('/governorates/unknown-city')->assertNotFound();
    $this->get('/governorates/not-a-governorate')->assertNotFound();
});

test('sitemap includes hub and all 14 governorate pages, and image sitemap includes all 14 governorate icons', function () {
    $sitemapPaths = array_map(fn ($u) => $u->path, app(SitemapBuilder::class)->build());

    expect($sitemapPaths)->toContain('/governorates');
    foreach (Facts::governorates() as $gov) {
        expect($sitemapPaths)->toContain('/governorates/'.$gov['id']);
    }

    $imageEntries = collect(app(ImageSitemapBuilder::class)->build())->keyBy('path');
    $icons = GovernorateDataService::allIconPaths();

    expect($icons)->toHaveCount(14)
        ->and($imageEntries->has('/governorates'))->toBeTrue()
        ->and($imageEntries['/governorates']->images)->toHaveCount(14);

    foreach ($icons as $id => $path) {
        expect($imageEntries->has('/governorates/'.$id))->toBeTrue()
            ->and($imageEntries['/governorates/'.$id]->images)->toContain($path);
    }
});

test('governorate page omits missing dynamic sections when data is absent', function () {
    fakeAladhanFailure();

    // Empty database: Damascus has no crossings, no transit rows, no places, no phonebook, no population rows, no live prayer timings.
    $this->get('/governorates/damascus')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Governorates/Show')
            ->where('population', null)
            ->where('prayer', null)
            ->where('transit', null)
            ->where('crossings', [])
            ->where('places', null)
            ->where('phonebook', [])
            // Sourced governor fallback from resources/data/governorates/governors.json still populates officials
            ->where('officials.governor.name_ar', 'ماهر محمد مروان إدلبي')
            ->where('officials.jard_credit.name_ar', 'جَرد'));
});

test('governorate page populates all sections and Person JSON-LD when backed by data', function () {
    fakeAladhanSuccess();

    PopulationDemographic::create([
        'data_type' => 'population',
        'source_id' => 4,
        'note' => 'Governorate populations',
        'date' => '2021-01-01',
        'source_url' => 'https://www.geo-ref.net/en/syr.htm',
        'city_name' => 'Aleppo',
        'value' => 4118000,
    ]);

    $official = GovtOfficial::create([
        'slug' => 'azzam-al-gharib',
        'full_name_ar' => 'عزام محمد الغريب',
        'display_name_ar' => 'عزام الغريب',
        'portrait_url' => '/images/govtcvs/azzam.webp',
        'publish_status' => 'published',
        'published_at' => now(),
    ]);

    GovtTenure::create([
        'official_id' => $official->id,
        'institution_name_ar' => 'محافظة حلب',
        'role_title_ar' => 'محافظ حلب',
        'tier' => 'governor',
        'status' => 'current',
        'started_at' => '2024-12-21',
    ]);

    City::create([
        'id' => 'aleppo',
        'name_ar' => 'حلب',
        'name_en' => 'Aleppo',
        'center' => 'POINT(37.1343 36.2021)',
        'bounds' => 'POLYGON((37.0 36.1, 37.3 36.1, 37.3 36.3, 37.0 36.3, 37.0 36.1))',
        'zoom' => 12,
        'status' => 'active',
    ]);

    TransitRoute::create([
        'id' => 'aleppo-line-1',
        'city_id' => 'aleppo',
        'name_ar' => 'خط سيف الدولة — الجامعة',
        'status' => 'published',
    ]);

    $place = Place::factory()->approved()->create([
        'name' => 'قلعة حلب',
        'category' => 'historical',
        'lat' => 36.1992,
        'lng' => 37.1626,
    ]);

    PhonebookCategory::create([
        'id' => 'ministry_of_interior',
        'label_ar' => 'وزارة الداخلية',
        'label_en' => 'Ministry of Interior',
        'icon' => 'shield',
        'order_column' => 1,
        'is_active' => true,
    ]);

    PhonebookEntry::create([
        'id' => 'pb-aleppo-1',
        'category_id' => 'ministry_of_interior',
        'name_ar' => 'إدارة الأمن العام (عمليات حلب)',
        'name_en' => 'Aleppo Security Operations',
        'number' => '2241300',
        'is_whatsapp' => false,
        'order_column' => 1,
        'is_active' => true,
    ]);

    $response = $this->get('/governorates/aleppo')->assertOk();

    // Person JSON-LD emitted for well-sourced governor
    $response->assertSee('"@type":"Person"', false)
        ->assertSee('عزام محمد الغريب', false)
        ->assertInertia(fn ($page) => $page
            ->component('Governorates/Show')
            ->where('population.value', 4118000)
            ->where('population.year', '2021')
            ->where('officials.governor.slug', 'azzam-al-gharib')
            ->where('prayer.timings.Fajr', '05:15')
            ->where('transit.routes_count', 1)
            ->where('transit.routes.0.name_ar', 'خط سيف الدولة — الجامعة')
            ->has('crossings', 3)
            ->where('places.total', 1)
            ->where('places.notable.0.name', 'قلعة حلب')
            ->where('places.notable.0.url', $place->publicPath())
            ->has('phonebook', 1)
            ->where('phonebook.0.number', '2241300'));
});

test('crossing detail page receives its parent governorate prop for cross-linking', function () {
    $this->get('/crossings/bab-al-hawa')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Crossings/Show')
            ->where('slug', 'bab-al-hawa')
            ->where('governorate.id', 'idlib')
            ->where('governorate.nameAr', 'إدلب'));
});
