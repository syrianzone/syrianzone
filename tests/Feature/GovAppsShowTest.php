<?php

use App\Mcp\Tools\GovApps\UpdateGovAppTool;
use App\Models\GovApp;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Models\User;
use App\Services\GovApps\GovAppPresenter;
use App\Services\Sitemap\SitemapBuilder;
use Inertia\Testing\AssertableInertia as Assert;

it('renders a dedicated gov app guide page with SoftwareApplication JSON-LD and self canonical when rich', function () {
    $category = OfficialCategory::factory()->create(['id' => 'ministries']);
    $ministry = OfficialEntity::factory()->inCategory($category)->create([
        'id' => 'min-interior',
        'name' => 'Ministry of Interior',
        'name_ar' => 'وزارة الداخلية السورية',
    ]);

    $app = GovApp::factory()->create([
        'id' => 'civic',
        'name' => 'Civil Affairs',
        'name_ar' => 'تطبيق الشؤون المدنية',
        'official_entity_id' => $ministry->id,
        'overview_ar' => 'دليل شامل لتطبيق الشؤون المدنية الرسمي الصادر عن وزارة الداخلية.',
        'features' => ['حجز مواعيد', 'التحقق عبر الباركود', 'تقديم طلبات الحج'],
        'requirements' => ['رقم هاتف سوري فعّال'],
        'faqs' => [['q' => 'هل التطبيق مجاني؟', 'a' => 'نعم، مجاني بالكامل.']],
        'verified_at' => '2026-11-21',
        'links' => [
            'android' => 'https://play.google.com/store/apps/details?id=civilaffairs.moi.gov.sy.mica',
            'apple' => 'https://apps.apple.com/us/app/civil-affairs/id6804969787',
        ],
        'is_active' => true,
    ]);

    $response = $this->get('/govapps/civic')->assertOk();

    $response->assertInertia(fn (Assert $page) => $page
        ->component('GovApps/Show')
        ->where('app.id', 'civic')
        ->where('app.has_rich_guide', true)
        ->where('app.publisher.id', 'min-interior')
        ->where('app.store_identifiers.android_package', 'civilaffairs.moi.gov.sy.mica')
        ->where('app.store_identifiers.android_source', 'google_play')
        ->where('app.store_identifiers.apple_id', 'id6804969787')
        ->where('app.store_identifiers.apple_source', 'app_store')
        ->has('app.features', 3)
        ->has('app.faqs', 1)
    );

    $html = $response->getContent();
    expect($html)->toContain('SoftwareApplication')
        ->and($html)->toContain('/govapps/civic')
        ->and($html)->toContain('وزارة الداخلية السورية');

    $sitemapPaths = collect(app(SitemapBuilder::class)->build())->pluck('path')->all();
    expect($sitemapPaths)->toContain('/govapps/civic');
});

it('canonicalizes thin gov app pages back to /govapps and excludes them from sitemap', function () {
    GovApp::factory()->create([
        'id' => 'thin-app',
        'name' => 'Thin App',
        'name_ar' => 'تطبيق مختصر',
        'overview_ar' => null,
        'features' => [],
        'is_active' => true,
    ]);

    $response = $this->get('/govapps/thin-app')->assertOk();
    expect($response->getContent())->toContain('rel="canonical" href="https://syrian.zone/govapps"');

    $sitemapPaths = collect(app(SitemapBuilder::class)->build())->pluck('path')->all();
    expect($sitemapPaths)->not->toContain('/govapps/thin-app');
});

it('returns 404 for inactive or soft-deleted gov apps', function () {
    GovApp::factory()->inactive()->create(['id' => 'hidden-app']);
    $deleted = GovApp::factory()->create(['id' => 'deleted-app']);
    $deleted->delete();

    $this->get('/govapps/hidden-app')->assertNotFound();
    $this->get('/govapps/deleted-app')->assertNotFound();
});

it('updates gov app guide fields via update-gov-app MCP tool', function () {
    $category = OfficialCategory::factory()->create(['id' => 'ministries']);
    OfficialEntity::factory()->inCategory($category)->create(['id' => 'min-foreign']);

    $app = GovApp::factory()->create(['id' => 'mofa']);
    $user = User::factory()->create(['role' => 'user', 'permissions' => ['govapps.edit']]);
    agentToken($user, ['govapps.edit']);

    $payload = toolPayload(callTool(UpdateGovAppTool::class, [
        'id' => 'mofa',
        'official_entity_id' => 'min-foreign',
        'overview_ar' => 'تطبيق وزارة الخارجية والمغتربين للخدمات القنصلية.',
        'features' => ['حجز مواعيد قنصلية', 'تصديق الوثائق', 'متابعة المعاملات'],
        'requirements' => ['بريد إلكتروني فعّال'],
        'faqs' => [['q' => 'هل يعمل خارج سوريا؟', 'a' => 'نعم، مخصّص للمغتربين.']],
        'verified_at' => '2026-11-21',
    ]));

    expect($payload['updated'])->toBeTrue()
        ->and($payload['app']['official_entity_id'])->toBe('min-foreign')
        ->and($payload['app']['has_rich_guide'])->toBeTrue()
        ->and($payload['app']['features'])->toHaveCount(3)
        ->and($payload['app']['faqs'])->toHaveCount(1);
});

it('classifies android and apple distribution sources accurately', function () {
    $presenter = app(GovAppPresenter::class);

    expect($presenter->extractStoreIdentifiers([
        'android' => 'https://play.google.com/store/apps/details?id=sy.mofa.app',
        'apple' => 'https://apps.apple.com/us/app/mofa-sy/id6755138946',
    ]))->toMatchArray([
        'android_source' => 'google_play',
        'android_package' => 'sy.mofa.app',
        'is_direct_apk' => false,
        'apple_source' => 'app_store',
        'apple_id' => 'id6755138946',
    ]);

    expect($presenter->extractStoreIdentifiers([
        'android' => 'https://api-seg.moenergy.gov.sy/syrian-energy-gate.apk',
    ]))->toMatchArray([
        'android_source' => 'direct_apk',
        'android_package' => null,
        'is_direct_apk' => true,
        'apple_source' => null,
    ]);

    expect($presenter->extractStoreIdentifiers([
        'android' => 'https://t.me/GAdofCA/226',
    ]))->toMatchArray([
        'android_source' => 'telegram',
        'android_package' => null,
        'is_direct_apk' => false,
    ]);

    expect($presenter->extractStoreIdentifiers([
        'android' => 'https://bunat.moad.gov.sy/download/?id=42',
        'apple' => 'https://testflight.apple.com/join/abc123',
    ]))->toMatchArray([
        'android_source' => 'website',
        'android_package' => null,
        'is_direct_apk' => false,
        'apple_source' => 'testflight',
        'apple_id' => null,
    ]);

    expect($presenter->extractStoreIdentifiers([
        'android' => 'https://appgallery.huawei.com/app/C123456',
    ]))->toMatchArray([
        'android_source' => 'huawei_appgallery',
        'android_package' => null,
        'is_direct_apk' => false,
    ]);
});
