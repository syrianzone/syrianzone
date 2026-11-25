<?php

use App\Models\GovApp;
use App\Services\Sitemap\SitemapBuilder;
use App\Support\Facts;

test('crossing detail page renders with CivicStructure JSON-LD, self-canonical, and sitemap entry', function () {
    $response = $this->get('/crossings/bab-al-hawa')->assertOk();

    $response->assertSee('rel="canonical" href="'.rtrim((string) config('seo.base_url'), '/').'/crossings/bab-al-hawa"', false);
    $response->assertSee('CivicStructure', false);
    $response->assertInertia(fn ($page) => $page
        ->component('Crossings/Show')
        ->where('slug', 'bab-al-hawa'));

    $sitemapPaths = array_map(fn ($u) => $u->path, app(SitemapBuilder::class)->build());
    $crossings = Facts::json('crossings')['crossings'] ?? [];

    expect($crossings)->toHaveCount(20);
    foreach ($crossings as $crossing) {
        expect($sitemapPaths)->toContain('/crossings/'.$crossing['slug']);
    }
});

test('crossings query link canonicalizes to the dedicated crossing slug page and unknown slugs 404', function () {
    $this->get('/crossings?c=1')
        ->assertOk()
        ->assertSee('rel="canonical" href="'.rtrim((string) config('seo.base_url'), '/').'/crossings/bab-al-hawa"', false);

    $this->get('/crossings/does-not-exist')->assertNotFound();
});

test('governorate prayer pages render with city metadata and appear in sitemap', function () {
    $response = $this->get('/muslim/prayer/aleppo')->assertOk();

    $response->assertSee('rel="canonical" href="'.rtrim((string) config('seo.base_url'), '/').'/muslim/prayer/aleppo"', false);
    $response->assertSee('مواقيت الصلاة في حلب اليوم', false);
    $response->assertInertia(fn ($page) => $page
        ->component('Muslim/Prayer/Index')
        ->where('initialCity', 'aleppo')
        ->where('initialCityName', 'حلب'));

    $this->get('/muslim/prayer/unknown-city')->assertNotFound();

    $sitemapPaths = array_map(fn ($u) => $u->path, app(SitemapBuilder::class)->build());
    foreach (Facts::governorates() as $gov) {
        expect($sitemapPaths)->toContain('/muslim/prayer/'.$gov['id']);
    }
});

test('rich govapp page emits FAQPage JSON-LD alongside SoftwareApplication', function () {
    GovApp::create([
        'id' => 'faq-test-app',
        'name' => 'FAQ Test App',
        'name_ar' => 'تطبيق اختبار الأسئلة',
        'description' => 'Test',
        'description_ar' => 'وصف تجريبي',
        'overview_ar' => 'نظرة عامة تفصيلية عن التطبيق الحكومي الرسمي في سوريا.',
        'features' => ['ميزة 1', 'ميزة 2', 'ميزة 3'],
        'faqs' => [
            ['q' => 'هل التطبيق مجاني؟', 'a' => 'نعم، مجاني بالكامل.'],
        ],
        'links' => ['official' => 'https://example.gov.sy'],
        'order_column' => 1,
        'is_active' => true,
    ]);

    $this->get('/govapps/faq-test-app')
        ->assertOk()
        ->assertSee('SoftwareApplication', false)
        ->assertSee('FAQPage', false)
        ->assertSee('هل التطبيق مجاني؟', false);
});

test('orphan party page is excluded from sitemap.xml and llms.txt', function () {
    $sitemapPaths = array_map(fn ($u) => $u->path, app(SitemapBuilder::class)->build());
    expect($sitemapPaths)->not->toContain('/party');

    $llms = $this->get('/llms.txt')->assertOk()->getContent();
    expect($llms)->not->toContain('/party')
        ->and($llms)->toContain('/govapps/{id}')
        ->and($llms)->toContain('/crossings/{slug}')
        ->and($llms)->toContain('/muslim/prayer/{city}');
});
