<?php

use App\Models\GovApp;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Services\Sitemap\ImageSitemapBuilder;
use App\Services\Sitemap\SitemapBuilder;
use Database\Seeders\GovAppsSeeder;

test('govapps_guides.json is valid and every entry satisfies rich guide and FAQ requirements', function () {
    $expectedIds = [
        'civic', 'mofa', 'sw', 'moha', 'seg', 'sham', 'masjidak', 'syal',
        'bunat', 'f3alia', 'paymera', 'anjez', 'agents', 'teacher', 'principle',
        'sytel', 'ecsc', 'dam', 'alp', 'varx', 'swish', 'petde', 'waf', 'dse',
    ];

    $raw = file_get_contents(resource_path('data/govapps_guides.json'));
    expect($raw)->toBeString();

    $guides = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    expect($guides)->toBeArray();
    expect(array_keys($guides))->toEqualCanonicalizing($expectedIds);

    foreach ($guides as $id => $guide) {
        expect($guide)->toBeArray("Guide for {$id} must be an object");
        expect(trim((string) ($guide['description_ar'] ?? '')))->not->toBe('', "Missing description_ar for {$id}");
        expect(trim((string) ($guide['overview_ar'] ?? '')))->not->toBe('', "Missing overview_ar for {$id}");
        expect($guide['features'] ?? null)->toBeArray("Features for {$id} must be an array");
        expect(count($guide['features']))->toBeGreaterThanOrEqual(3, "App {$id} must have >= 3 features");
        expect($guide['requirements'] ?? null)->toBeArray("Requirements for {$id} must be an array");
        expect(count($guide['requirements']))->toBeGreaterThanOrEqual(3, "App {$id} must have >= 3 requirements");
        expect($guide['faqs'] ?? null)->toBeArray("FAQs for {$id} must be an array");
        expect(count($guide['faqs']))->toBeGreaterThanOrEqual(3, "App {$id} must have >= 3 FAQs");

        foreach ($guide['faqs'] as $faq) {
            expect($faq)->toBeArray()
                ->and(trim((string) ($faq['q'] ?? '')))->not->toBe('')
                ->and(trim((string) ($faq['a'] ?? '')))->not->toBe('');
        }

        expect(trim((string) ($guide['verified_at'] ?? '')))->toMatch('/^\d{4}-\d{2}-\d{2}$/');

        $app = new GovApp([
            'id' => $id,
            'overview_ar' => $guide['overview_ar'],
            'features' => $guide['features'],
        ]);
        expect($app->hasRichGuide())->toBeTrue("Guide for {$id} must satisfy GovApp::hasRichGuide()");
    }
});

test('rich guides migration upgrades thin gov_apps rows without overwriting existing editorial content', function () {
    OfficialCategory::create([
        'id' => 'ministries',
        'label_en' => 'Ministries',
        'label_ar' => 'الوزارات',
        'order_column' => 1,
        'is_active' => true,
    ]);
    OfficialCategory::create([
        'id' => 'governorates',
        'label_en' => 'Governorates',
        'label_ar' => 'المحافظات',
        'order_column' => 2,
        'is_active' => true,
    ]);
    OfficialCategory::create([
        'id' => 'authorities_agencies',
        'label_en' => 'Authorities',
        'label_ar' => 'الهيئات والمؤسسات',
        'order_column' => 3,
        'is_active' => true,
    ]);

    foreach ([
        ['id' => 'min-interior', 'category_id' => 'ministries', 'name' => 'Ministry of Interior', 'name_ar' => 'وزارة الداخلية السورية'],
        ['id' => 'min-education', 'category_id' => 'ministries', 'name' => 'Ministry of Education', 'name_ar' => 'وزارة التربية والتعليم السورية'],
        ['id' => 'gov-damascus', 'category_id' => 'governorates', 'name' => 'Damascus Governorate', 'name_ar' => 'محافظة دمشق'],
        ['id' => 'other-syrian-telecom', 'category_id' => 'authorities_agencies', 'name' => 'Syrian Telecom', 'name_ar' => 'الشركة السورية للاتصالات'],
        ['id' => 'other-citizen-service', 'category_id' => 'authorities_agencies', 'name' => 'ECSC', 'name_ar' => 'مركز خدمة المواطن الإلكتروني'],
    ] as $entity) {
        OfficialEntity::create($entity + ['order_column' => 1, 'is_active' => true]);
    }

    $customCivicOverview = 'نظرة عامة مخصّصة محرّرة يدوياً في لوحة التحكم ولا يجب استبدالها.';
    GovApp::create([
        'id' => 'civic',
        'name' => 'Civil Affairs',
        'name_ar' => 'تطبيق الشؤون المدنية لوزارة الداخلية',
        'description' => 'وصف الشؤون المدنية',
        'description_ar' => 'وصف الشؤون المدنية',
        'official_entity_id' => 'min-interior',
        'overview_ar' => $customCivicOverview,
        'features' => ['ميزة مخصّصة 1', 'ميزة مخصّصة 2', 'ميزة مخصّصة 3'],
        'requirements' => ['متطلب مخصّص'],
        'faqs' => [['q' => 'سؤال مخصّص؟', 'a' => 'إجابة مخصّصة.']],
        'verified_at' => '2026-11-21',
        'links' => ['android' => 'https://play.google.com/store/apps/details?id=civilaffairs.moi.gov.sy.mica'],
        'order_column' => 1,
        'is_active' => true,
    ]);

    $thinApps = [
        ['id' => 'sham', 'name' => 'تطبيق شام كاش', 'name_ar' => 'تطبيق شام كاش', 'description' => 'تطبيق الدفع الإلكتروني', 'description_ar' => 'تطبيق الدفع الإلكتروني', 'links' => ['official' => 'https://www.shamcash.sy/en']],
        ['id' => 'sw', 'name' => 'Sawtak Wesel', 'name_ar' => 'تطبيق صوتك وصل', 'description' => 'تطبيق وزارة الداخلية للشكاوى', 'description_ar' => 'تطبيق وزارة الداخلية للشكاوى', 'links' => ['android' => 'https://play.google.com/store/apps/details?id=sy.moi.sw_app']],
        ['id' => 'dam', 'name' => 'تطبيق محلولة - محافظة دمشق', 'name_ar' => 'تطبيق محلولة - محافظة دمشق', 'description' => '', 'description_ar' => '', 'links' => ['official' => 'https://plat.damascus.gov.sy/complaint.html']],
        ['id' => 'teacher', 'name' => 'تطبيق المدرّس', 'name_ar' => 'تطبيق المدرّس', 'description' => null, 'description_ar' => 'تطبيق للمدرسين لإدخال درجات الطلاب', 'links' => ['official' => 'https://moed.gov.sy/services']],
        ['id' => 'sytel', 'name' => 'تطبيق السورية للاتصالات', 'name_ar' => 'تطبيق السورية للاتصالات', 'description' => '', 'description_ar' => '', 'links' => ['android' => 'https://syriantelecom.com.sy/apks/STApp.apk']],
        ['id' => 'ecsc', 'name' => 'تطبيق معاملاتي', 'name_ar' => 'تطبيق معاملاتي', 'description' => '', 'description_ar' => '', 'links' => ['official' => 'https://ecsc.gov.sy/mobile']],
    ];

    foreach ($thinApps as $index => $row) {
        GovApp::create($row + ['order_column' => $index + 2, 'is_active' => true]);
    }

    foreach (['sham', 'sw', 'dam', 'teacher', 'sytel', 'ecsc'] as $id) {
        expect(GovApp::findOrFail($id)->hasRichGuide())->toBeFalse();
    }

    $migration = require database_path('migrations/2026_11_27_120000_populate_gov_apps_rich_guides.php');
    $migration->up();

    // Pre-existing custom content on civic must be untouched.
    $civic = GovApp::findOrFail('civic');
    expect($civic->overview_ar)->toBe($customCivicOverview)
        ->and($civic->features)->toBe(['ميزة مخصّصة 1', 'ميزة مخصّصة 2', 'ميزة مخصّصة 3'])
        ->and($civic->faqs)->toBe([['q' => 'سؤال مخصّص؟', 'a' => 'إجابة مخصّصة.']])
        ->and($civic->verified_at?->toDateString())->toBe('2026-11-21');

    // Thin rows are upgraded to rich guides and empty descriptions + fold columns are populated.
    foreach (['sham', 'sw', 'dam', 'teacher', 'sytel', 'ecsc'] as $id) {
        $app = GovApp::findOrFail($id);
        expect($app->hasRichGuide())->toBeTrue("App {$id} should now have a rich guide")
            ->and(filled($app->description_ar))->toBeTrue("App {$id} should have non-empty description_ar")
            ->and(filled($app->description_ar_fold))->toBeTrue("App {$id} should have folded description_ar_fold")
            ->and(count($app->faqs))->toBeGreaterThanOrEqual(3);
    }

    expect(GovApp::findOrFail('sw')->official_entity_id)->toBe('min-interior')
        ->and(GovApp::findOrFail('dam')->official_entity_id)->toBe('gov-damascus')
        ->and(GovApp::findOrFail('teacher')->official_entity_id)->toBe('min-education')
        ->and(GovApp::findOrFail('sytel')->official_entity_id)->toBe('other-syrian-telecom')
        ->and(GovApp::findOrFail('ecsc')->official_entity_id)->toBe('other-citizen-service')
        ->and(GovApp::findOrFail('sham')->official_entity_id)->toBeNull();
});

test('upgraded sham and sw pages render self-canonical, SoftwareApplication + FAQPage JSON-LD, and appear in sitemaps', function () {
    GovApp::create([
        'id' => 'sham',
        'name' => 'تطبيق شام كاش',
        'name_ar' => 'تطبيق شام كاش',
        'description' => 'تطبيق الدفع الإلكتروني المعتمد حالياً في الوظائف الحكومية',
        'description_ar' => 'تطبيق الدفع الإلكتروني المعتمد حالياً في الوظائف الحكومية',
        'icon' => 'https://media.syrian.zone/govapps/sham/icon.webp',
        'images' => ['https://media.syrian.zone/govapps/sham/screenshots/screen_1.webp'],
        'links' => ['official' => 'https://www.shamcash.sy/en'],
        'order_column' => 1,
        'is_active' => true,
    ]);

    GovApp::create([
        'id' => 'sw',
        'name' => 'Sawtak Wesel',
        'name_ar' => 'تطبيق صوتك وصل',
        'description' => 'تطبيق وزارة الداخلية للتواصل وإرسال الشكاوى',
        'description_ar' => 'تطبيق وزارة الداخلية للتواصل وإرسال الشكاوى',
        'icon' => 'https://media.syrian.zone/govapps/sw/icon.webp',
        'images' => ['https://media.syrian.zone/govapps/sw/screenshots/screen_1.webp'],
        'links' => [
            'android' => 'https://play.google.com/store/apps/details?id=sy.moi.sw_app',
            'apple' => 'https://apps.apple.com/us/app/id6802613256',
        ],
        'order_column' => 2,
        'is_active' => true,
    ]);

    GovAppsSeeder::applyGuides();

    $baseUrl = rtrim((string) config('seo.base_url'), '/');

    foreach (['sham', 'sw'] as $id) {
        $this->get('/govapps/'.$id)
            ->assertOk()
            ->assertSee('rel="canonical" href="'.$baseUrl.'/govapps/'.$id.'"', false)
            ->assertSee('SoftwareApplication', false)
            ->assertSee('FAQPage', false);
    }

    $sitemapPaths = array_map(fn ($u) => $u->path, app(SitemapBuilder::class)->build());
    expect($sitemapPaths)
        ->toContain('/govapps/sham')
        ->toContain('/govapps/sw');

    $imageSitemapPaths = array_map(fn ($u) => $u->path, app(ImageSitemapBuilder::class)->build());
    expect($imageSitemapPaths)
        ->toContain('/govapps/sham')
        ->toContain('/govapps/sw');
});
