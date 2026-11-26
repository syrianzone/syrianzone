<?php

use App\Models\GovtOfficial;
use App\Models\GovtTenure;
use App\Models\SiteSetting;
use App\Models\User;
use App\Services\Transit\TransitCities;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Vite;
use Inertia\Testing\AssertableInertia as Assert;

test('govtcvs index sends a lean DTO with active_tenure and caches until published data changes', function () {
    Cache::flush();

    $official = GovtOfficial::create([
        'slug' => 'lean-dto-official',
        'full_name_ar' => 'الدكتور سامر الخطيب',
        'display_name_ar' => 'سامر الخطيب',
        'full_name_en' => 'Samer Al-Khatib',
        'honorific_ar' => 'الدكتور',
        'bio_summary_ar' => 'نبذة موجزة عن المسؤول.',
        'office_status' => 'in_office',
        'highest_tier' => 'minister',
        'cv_completeness' => 'full_cv',
        'publish_status' => 'published',
        'verification_level' => 'decree_verified',
        'published_at' => now(),
    ]);

    GovtTenure::create([
        'official_id' => $official->id,
        'institution_name_ar' => 'وزارة الاقتصاد',
        'role_title_ar' => 'وزير الاقتصاد',
        'tier' => 'minister',
        'government_phase' => 'transitional_2025',
        'status' => 'current',
        'started_at' => '2025-03-29',
        'start_date_precision' => 'exact',
    ]);

    $this->get('/govtcvs')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('GovtCvs/Index')
            ->has('officials', 1)
            ->has('stats')
            ->has('institutions')
            ->where('officials.0.slug', 'lean-dto-official')
            ->where('officials.0.active_tenure.role_title_ar', 'وزير الاقتصاد')
            ->missing('officials.0.current_tenures')
            ->missing('officials.0.current_tenure')
            ->missing('officials.0.latest_tenure')
            ->missing('officials.0.resolved_portrait_url')
            ->missing('officials.0.office_status_label')
            ->missing('officials.0.highest_tier_label')
            ->missing('officials.0.cv_completeness_label')
            ->missing('officials.0.verification_level')
            ->missing('officials.0.publish_status')
        );

    // Show page still keeps its full payload
    $this->get('/govtcvs/lean-dto-official')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('GovtCvs/Show')
            ->has('official.current_tenure')
            ->has('official.latest_tenure')
            ->has('official.tenures', 1)
        );

    // Publishing another official refreshes the version-keyed cache automatically
    GovtOfficial::create([
        'slug' => 'second-published-official',
        'full_name_ar' => 'طارق الأحمد',
        'display_name_ar' => 'طارق الأحمد',
        'office_status' => 'in_office',
        'highest_tier' => 'governor',
        'cv_completeness' => 'positions_only',
        'publish_status' => 'published',
        'published_at' => now()->addSecond(),
    ]);

    $this->get('/govtcvs')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('officials', 2)
        );
});

test('siteNavigation and sitePopup are once-props keyed by their content and re-sent when it changes', function () {
    Cache::flush();

    $version = File::exists(public_path('build/manifest.json'))
        ? hash_file('xxh128', public_path('build/manifest.json'))
        : '';
    $visit = fn (string $except) => $this->get('/about', [
        'X-Inertia' => 'true',
        'X-Inertia-Version' => $version,
        'X-Inertia-Except-Once-Props' => $except,
    ])->assertOk();
    $keyFor = fn (array $onceProps, string $prop) => collect($onceProps)
        ->filter(fn (array $meta) => $meta['prop'] === $prop)
        ->keys()
        ->first();

    // 1. A first visit carries both props and announces their once keys.
    $first = $visit('');
    expect($first->json('props'))->toHaveKey('siteNavigation')
        ->and($first->json('props'))->toHaveKey('sitePopup');
    $navKey = $keyFor($first->json('onceProps'), 'siteNavigation');
    $popupKey = $keyFor($first->json('onceProps'), 'sitePopup');
    expect($navKey)->toStartWith('siteNavigation:')
        ->and($popupKey)->toStartWith('sitePopup:');

    // The full HTML load announces the same key.
    expect($this->get('/')->assertOk()->getContent())->toContain($navKey);

    // 2. A client that already holds the current keys gets neither prop.
    $omitted = $visit("{$navKey},{$popupKey}");
    expect($omitted->json('props'))->not->toHaveKey('siteNavigation')
        ->and($omitted->json('props'))->not->toHaveKey('sitePopup');

    // 3. A stale key gets the prop again.
    expect($visit('siteNavigation:stale')->json('props'))->toHaveKey('siteNavigation');

    // 4. An admin edit changes the content, hence the key, so clients refetch.
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $nav = SiteSetting::getNavigation();
    $this->actingAs($superadmin)
        ->putJson('/api/v1/admin/navigation', [
            'navbarTopCount' => $nav['navbarTopCount'],
            'items' => $nav['items'],
        ])
        ->assertOk();

    $afterEdit = $visit($navKey);
    expect($afterEdit->json('props'))->toHaveKey('siteNavigation')
        ->and($keyFor($afterEdit->json('onceProps'), 'siteNavigation'))->not->toBe($navKey);
});

test('app blade preloads the current page chunk and skips deferred or missing components', function () {
    $manifestPath = public_path('build/manifest.json');
    if (! is_file($manifestPath)) {
        $this->markTestSkipped('Vite manifest not built yet.');
    }

    // A developer's running (or stale) `public/hot` file would switch @vite to
    // dev-server tags, which never preload. Assert the production output.
    Vite::useHotFile(storage_path('framework/testing-no-hot-file'));

    $manifest = json_decode((string) file_get_contents($manifestPath), true);

    // TransitCities::forPage() calls MySQL-only ST_AsGeoJSON under SQLite in-memory tests.
    $this->mock(TransitCities::class, function ($mock) {
        $mock->shouldReceive('forPage')->andReturn([]);
        $mock->shouldReceive('forCards')->andReturn([]);
    });

    foreach ([
        '/' => 'resources/js/Pages/Home.tsx',
        '/govtcvs' => 'resources/js/Pages/GovtCvs/Index.tsx',
        '/transit' => 'resources/js/Pages/Transit/Index.tsx',
    ] as $route => $entry) {
        $chunkFile = $manifest[$entry]['file'] ?? null;
        expect($chunkFile)->toBeString();

        $html = $this->get($route)->assertOk()->getContent();
        expect($html)->toContain('rel="modulepreload"')
            ->and($html)->toContain($chunkFile);
    }

    // Error 404 page also works cleanly and preloads NotFound chunk
    $notFoundChunk = $manifest['resources/js/Pages/Errors/NotFound.tsx']['file'] ?? null;
    $notFoundHtml = $this->get('/nonexistent-route-for-preload-test')->assertNotFound()->getContent();
    expect($notFoundHtml)->toContain($notFoundChunk);

    // Deferred page does not preload its deferred chunk in the initial HTML
    $staff = moduleStaff('transit');
    $deferredChunk = $manifest['resources/js/Pages/Transit/admin/Index.tsx']['file'] ?? null;
    $adminHtml = $this->actingAs($staff)->get('/transit/admin')->assertOk()->getContent();
    expect($adminHtml)->not->toContain($deferredChunk);

    // Guard against non-existent component path rendered into app.blade.php directly
    $rendered = view('app', [
        'page' => [
            'component' => 'Missing/DoesNotExist',
            'props' => [],
            'url' => '/missing',
            'version' => '',
        ],
    ])->render();

    expect($rendered)->toContain($manifest['resources/js/app.tsx']['file']);
});
