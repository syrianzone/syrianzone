<?php

use App\Models\City;
use App\Models\GovApp;
use App\Models\GovtOfficial;
use App\Models\GovtTenure;
use App\Models\Place;
use App\Models\Poll;
use App\Models\Promise;
use App\Models\PromiseSpeaker;
use App\Models\Route as TransitRoute;
use App\Services\IndexNow\IndexNow;
use App\Services\Sitemap\SitemapBuilder;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

function enableIndexNowInProduction(string $key = 'test-indexnow-key-1234'): IndexNow
{
    app()['env'] = 'production';
    config([
        'seo.base_url' => 'https://syrian.zone',
        'seo.indexnow.enabled' => true,
        'seo.indexnow.key' => $key,
        'seo.indexnow.endpoint' => 'https://api.indexnow.org/indexnow',
    ]);

    Cache::forget(IndexNow::CACHE_KEY);

    return app(IndexNow::class);
}

test('indexnow is disabled outside production, when flag is false, or when key is missing', function () {
    Http::fake();

    // Outside production (testing env), even with enabled=true and a key.
    config([
        'seo.indexnow.enabled' => true,
        'seo.indexnow.key' => 'test-key-1234',
    ]);

    $service = app(IndexNow::class);
    $service->queue('/about');
    $result = $service->flush();

    expect($service->isEnabled())->toBeFalse()
        ->and($service->pending())->toBe([])
        ->and($result)->toBe(['submitted' => 0, 'kept' => 0, 'batches' => 0]);
    Http::assertNothingSent();

    // In production, disabled when enabled=false.
    app()['env'] = 'production';
    config([
        'seo.indexnow.enabled' => false,
        'seo.indexnow.key' => 'test-key-1234',
    ]);
    $service->queue('/about');
    expect($service->isEnabled())->toBeFalse()
        ->and($service->pending())->toBe([]);

    // In production, disabled when key is blank.
    config([
        'seo.indexnow.enabled' => true,
        'seo.indexnow.key' => '',
    ]);
    $service->queue('/about');
    expect($service->isEnabled())->toBeFalse()
        ->and($service->pending())->toBe([]);

    Http::assertNothingSent();
});

test('key route serves configured key as plain text without cookies and 404s everything else', function () {
    config(['seo.indexnow.key' => 'abc12345-xyz']);

    $response = $this->get('/abc12345-xyz.txt')->assertOk();

    expect($response->getContent())->toBe('abc12345-xyz')
        ->and($response->headers->get('Content-Type'))->toBe('text/plain; charset=UTF-8')
        ->and($response->headers->get('Cache-Control'))->toContain('public')
        ->and($response->headers->getCookies())->toBe([]);

    $this->get('/wrong-key.txt')->assertNotFound();
    $this->get('/abc12345-xyz-extra.txt')->assertNotFound();

    // Unset key also 404s everything.
    config(['seo.indexnow.key' => '']);
    $this->get('/abc12345-xyz.txt')->assertNotFound();
});

test('indexnow queues canonical urls, deduplicates, and flushes in IndexNow JSON format', function () {
    Http::fake(['https://api.indexnow.org/indexnow' => Http::response('', 200)]);

    $indexNow = enableIndexNowInProduction('my-secret-key-01');

    $indexNow->queue([
        '/promises/1',
        'promises/1',
        'https://syrian.zone/promises/1',
        'https://other-host.example/promises/1',
        '/govtcvs/ahmad-al-sharaa',
        '   ',
    ]);

    expect($indexNow->pending())->toBe([
        'https://syrian.zone/promises/1',
        'https://syrian.zone/govtcvs/ahmad-al-sharaa',
    ]);

    $result = $indexNow->flush();

    expect($result)->toBe(['submitted' => 2, 'kept' => 0, 'batches' => 1])
        ->and($indexNow->pending())->toBe([]);

    Http::assertSent(function (HttpRequest $request): bool {
        $data = $request->data();

        return $request->url() === 'https://api.indexnow.org/indexnow'
            && $data['host'] === 'syrian.zone'
            && $data['key'] === 'my-secret-key-01'
            && $data['keyLocation'] === 'https://syrian.zone/my-secret-key-01.txt'
            && $data['urlList'] === [
                'https://syrian.zone/promises/1',
                'https://syrian.zone/govtcvs/ahmad-al-sharaa',
            ];
    });
});

test('indexnow keeps urls on 5xx, 429, and connection failures, and drops on non-429 4xx', function () {
    $indexNow = enableIndexNowInProduction('retry-key-99');

    Http::fake([
        'https://api.indexnow.org/indexnow' => Http::sequence()
            ->push('Service Unavailable', 503)
            ->push('Rate Limited', 429)
            ->pushFailedConnection('timeout')
            ->push('Forbidden', 403),
    ]);

    $indexNow->queue('/promises/10');

    // 503 keeps URLs
    $res503 = $indexNow->flush();
    expect($res503)->toBe(['submitted' => 0, 'kept' => 1, 'batches' => 1])
        ->and($indexNow->pending())->toBe(['https://syrian.zone/promises/10']);

    // 429 keeps URLs
    $res429 = $indexNow->flush();
    expect($res429)->toBe(['submitted' => 0, 'kept' => 1, 'batches' => 1])
        ->and($indexNow->pending())->toBe(['https://syrian.zone/promises/10']);

    // Connection failure keeps URLs
    $resConn = $indexNow->flush();
    expect($resConn)->toBe(['submitted' => 0, 'kept' => 1, 'batches' => 1])
        ->and($indexNow->pending())->toBe(['https://syrian.zone/promises/10']);

    // 403 drops invalid submission rather than retrying forever
    $res403 = $indexNow->flush();
    expect($res403)->toBe(['submitted' => 0, 'kept' => 0, 'batches' => 1])
        ->and($indexNow->pending())->toBe([]);
});

test('indexnow chunks batches at 10000 urls and preserves remaining chunks on later failure', function () {
    $calls = 0;
    Http::fake(function () use (&$calls) {
        $calls++;

        return $calls === 1
            ? Http::response('', 202)
            : Http::response('Server Error', 500);
    });

    $indexNow = enableIndexNowInProduction('batch-key-77');

    $paths = [];
    for ($i = 1; $i <= 10005; $i++) {
        $paths[] = '/promises/'.$i;
    }
    $indexNow->queue($paths);

    $result = $indexNow->flush();

    expect($result)->toBe(['submitted' => 10000, 'kept' => 5, 'batches' => 2])
        ->and($indexNow->pending())->toHaveCount(5)
        ->and($indexNow->pending()[0])->toBe('https://syrian.zone/promises/10001');
});

test('indexnow:submit command submits all sitemap urls in chunks or explicit paths', function () {
    Http::fake(['https://api.indexnow.org/indexnow' => Http::response('', 200)]);

    enableIndexNowInProduction('cmd-key-42');

    // Explicit paths
    $this->artisan('indexnow:submit', ['path' => ['/about', '/promises']])
        ->assertSuccessful();

    Http::assertSentCount(1);

    // --all submits SitemapBuilder::build() URLs
    $expectedCount = count(app(SitemapBuilder::class)->build());
    $this->artisan('indexnow:submit', ['--all' => true])
        ->assertSuccessful();

    Http::assertSent(function (HttpRequest $request) use ($expectedCount): bool {
        return count($request->data()['urlList'] ?? []) === $expectedCount;
    });
});

test('indexnow:submit command is a no-op outside production', function () {
    Http::fake();

    config([
        'seo.indexnow.enabled' => true,
        'seo.indexnow.key' => 'cmd-key-42',
    ]);

    $this->artisan('indexnow:submit', ['--all' => true])
        ->assertSuccessful();

    Http::assertNothingSent();
});

test('model observers queue public indexable urls and removals, while ignoring unpublished records', function () {
    $indexNow = enableIndexNowInProduction('observer-key-55');

    // 1. Promise: unpublished does not queue; published + update + unpublish do.
    $speaker = PromiseSpeaker::factory()->create(['name' => 'متحدث', 'status' => 'approved']);
    $draftPromise = Promise::factory()->create([
        'speaker_id' => $speaker->id,
        'review_status' => 'pending',
        'number' => null,
    ]);
    expect($indexNow->pending())->toBe([]);

    $draftPromise->update(['title' => 'تعديل مسودة']);
    expect($indexNow->pending())->toBe([]);

    $draftPromise->update(['review_status' => 'published', 'number' => 77, 'published_at' => now()]);
    expect($indexNow->pending())->toBe([
        'https://syrian.zone/promises/77',
        'https://syrian.zone/promises',
    ]);

    Cache::forget(IndexNow::CACHE_KEY);
    $draftPromise->update(['review_status' => 'rejected']);
    expect($indexNow->pending())->toBe([
        'https://syrian.zone/promises/77',
        'https://syrian.zone/promises',
    ]);

    // 2. GovtOfficial + GovtTenure: draft ignored; published + tenure change + archive queued.
    Cache::forget(IndexNow::CACHE_KEY);
    $draftOfficial = GovtOfficial::create([
        'slug' => 'draft-official',
        'full_name_ar' => 'مسؤول مسودة',
        'display_name_ar' => 'مسؤول مسودة',
        'publish_status' => 'draft',
    ]);
    $draftTenure = GovtTenure::create([
        'official_id' => $draftOfficial->id,
        'role_title_ar' => 'وزير',
        'tier' => 'minister',
        'government_phase' => 'transitional_2025',
        'status' => 'current',
    ]);
    expect($indexNow->pending())->toBe([]);

    $draftOfficial->update(['publish_status' => 'published', 'published_at' => now()]);
    expect($indexNow->pending())->toBe([
        'https://syrian.zone/govtcvs/draft-official',
        'https://syrian.zone/govtcvs',
        'https://syrian.zone/govtcvs/movements',
    ]);

    Cache::forget(IndexNow::CACHE_KEY);
    $draftTenure->update(['role_title_ar' => 'وزير مكلف']);
    expect($indexNow->pending())->toBe([
        'https://syrian.zone/govtcvs/draft-official',
        'https://syrian.zone/govtcvs',
        'https://syrian.zone/govtcvs/movements',
    ]);

    Cache::forget(IndexNow::CACHE_KEY);
    $draftOfficial->update(['publish_status' => 'archived']);
    expect($indexNow->pending())->toBe([
        'https://syrian.zone/govtcvs/draft-official',
        'https://syrian.zone/govtcvs',
        'https://syrian.zone/govtcvs/movements',
    ]);

    // 3. GovApp: non-rich or inactive ignored; rich active queued; unpublishing rich app queued.
    Cache::forget(IndexNow::CACHE_KEY);
    $thinApp = GovApp::factory()->create([
        'id' => 'thin-app',
        'is_active' => true,
        'overview_ar' => null,
        'features' => ['1'],
    ]);
    expect($indexNow->pending())->toBe([]);

    $thinApp->update([
        'overview_ar' => 'دليل شامل للتطبيق الحكومي.',
        'features' => ['ميزة 1', 'ميزة 2', 'ميزة 3'],
    ]);
    expect($indexNow->pending())->toBe([
        'https://syrian.zone/govapps/thin-app',
        'https://syrian.zone/govapps',
    ]);

    Cache::forget(IndexNow::CACHE_KEY);
    $thinApp->update(['is_active' => false]);
    expect($indexNow->pending())->toBe([
        'https://syrian.zone/govapps/thin-app',
        'https://syrian.zone/govapps',
    ]);

    // 4. Poll: inactive ignored; active queued; core poll uses /tierlist; deactivating queued.
    Cache::forget(IndexNow::CACHE_KEY);
    $poll = Poll::factory()->create(['slug' => 'governors-poll', 'is_active' => false]);
    expect($indexNow->pending())->toBe([]);

    $poll->update(['is_active' => true]);
    expect($indexNow->pending())->toBe(['https://syrian.zone/polls/governors-poll']);

    Cache::forget(IndexNow::CACHE_KEY);
    $poll->update(['is_active' => false]);
    expect($indexNow->pending())->toBe(['https://syrian.zone/polls/governors-poll']);

    Cache::forget(IndexNow::CACHE_KEY);
    Poll::factory()->create(['slug' => Poll::coreSlug(), 'is_active' => true]);
    expect($indexNow->pending())->toBe(['https://syrian.zone/tierlist']);

    // 5. City + TransitRoute: draft route ignored; published route in active city queued; inactive city ignored.
    Cache::forget(IndexNow::CACHE_KEY);
    seedCity('homs', ['status' => 'active']);
    seedCity('idle-city', ['status' => 'inactive']);

    $draftRoute = transitRoute('route-draft-1', 'homs', ['status' => 'draft']);
    transitRoute('route-inactive-city', 'idle-city', ['status' => 'published']);
    expect($indexNow->pending())->toBe([]);

    $draftRoute->update(['status' => 'published']);
    expect($indexNow->pending())->toBe(['https://syrian.zone/transit/city/homs']);

    Cache::forget(IndexNow::CACHE_KEY);
    $homs = City::findOrFail('homs');
    $homs->update(['name_ar' => 'حمص المحدّثة']);
    expect($indexNow->pending())->toBe(['https://syrian.zone/transit/city/homs']);

    Cache::forget(IndexNow::CACHE_KEY);
    $draftRoute->update(['status' => 'disapproved']);
    expect($indexNow->pending())->toBe(['https://syrian.zone/transit/city/homs']);

    // 6. Place: pending/rejected ignored; approved and un-approved queued to /mishwar.
    Cache::forget(IndexNow::CACHE_KEY);
    $place = Place::factory()->create(['status' => 'pending']);
    expect($indexNow->pending())->toBe([]);

    $place->update(['status' => 'rejected']);
    expect($indexNow->pending())->toBe([]);

    $place->update(['status' => 'approved', 'approved_at' => now()]);
    expect($indexNow->pending())->toBe(['https://syrian.zone/mishwar']);

    Cache::forget(IndexNow::CACHE_KEY);
    $place->delete();
    expect($indexNow->pending())->toBe(['https://syrian.zone/mishwar']);
});
