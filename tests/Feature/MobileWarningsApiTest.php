<?php

use App\Services\PublicContent\WarningsFeedService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    Cache::flush();
    Carbon::setTestNow('2026-09-02T20:00:00Z');

    $routes = base_path('routes/mobile-public.php');
    if (is_file($routes) && ! Route::has('mobile.public.warnings')) {
        Route::middleware('api')->prefix('api')->group($routes);
    }
});

afterEach(fn () => Carbon::setTestNow());

function jardFixture(): string
{
    return file_get_contents(base_path('tests/Fixtures/jard-warnings.html'));
}

/** Builds a jard-style page around the given item rows. */
function jardPage(array $rows): string
{
    $page = json_encode(['props' => ['items' => ['data' => $rows]]], JSON_UNESCAPED_UNICODE);

    return '<html><body><div id="app" data-page="'.htmlspecialchars($page, ENT_QUOTES).'"></div></body></html>';
}

function jardRow(int $id, string $category, string $pubDate): array
{
    return [
        'id' => $id,
        'title' => "Item {$id}",
        'link' => "https://example.test/{$id}.xml",
        'description' => 'Body',
        'pub_date' => $pubDate,
        'feed' => ['name' => 'Feed', 'slug' => 'feed', 'category' => $category, 'color' => '#123456'],
    ];
}

test('warnings returns normalized items newest first', function () {
    Http::fake([WarningsFeedService::SOURCE_URL => Http::response(jardFixture())]);

    $response = $this->getJson('/api/mobile/warnings')->assertOk();
    $data = $response->json('data');

    expect(array_keys($data))->toBe(['items', 'fetched_at', 'stale'])
        ->and($data['stale'])->toBeFalse()
        ->and($data['fetched_at'])->toBe('2026-09-02T20:00:00+00:00')
        ->and($data['items'])->toHaveCount(20)
        ->and($data['items'][0])->toBe([
            'id' => '19901',
            'title' => 'استمرار ارتفاع منسوب نهر الفرات 2 أيلول 2026',
            'description' => 'نحذر الأهالي في محافظتي الرقة ودير الزور، ولا سيما القاطنين بالقرب من مجرى نهر الفرات، من الزيادة في كميات المياه الممررة من سد كديران وذلك لاستمرار ك...',
            'link' => 'https://climweb.med.gov.sy/api/cap/a4ac80ab-782a-4a2c-87e8-53d32cab84c3.xml',
            'published_at' => '2026-09-02T17:56:00+00:00',
            'source' => [
                'name' => 'أحدث التنبيهات من وزارة الطوارئ وإدارة الكوارث',
                'slug' => 'climweb_warnings',
                'color' => '#ef4444',
            ],
        ]);

    $dates = array_column($data['items'], 'published_at');
    $sorted = $dates;
    rsort($sorted);
    expect($dates)->toBe($sorted);
});

test('warnings drops items whose feed is not in the warnings category', function () {
    Http::fake([WarningsFeedService::SOURCE_URL => Http::response(jardPage([
        jardRow(1, 'news', '2026-09-02T10:00:00Z'),
        jardRow(2, 'warnings', '2026-09-01T10:00:00Z'),
        jardRow(3, 'warnings', '2026-09-02T09:00:00Z'),
    ]))]);

    $items = $this->getJson('/api/mobile/warnings')->assertOk()->json('data.items');

    expect(array_column($items, 'id'))->toBe(['3', '2'])
        ->and($items[0]['source']['color'])->toBe('#123456');
});

test('warnings caches the parsed page for five minutes', function () {
    Http::fake([WarningsFeedService::SOURCE_URL => Http::response(jardFixture())]);

    $this->getJson('/api/mobile/warnings')->assertOk();
    $this->getJson('/api/mobile/warnings')->assertOk();

    Http::assertSentCount(1);
});

test('warnings serves the last good payload flagged stale when the upstream fails', function () {
    // A second Http::fake would stack behind the first stub, so one sequence
    // serves the good page and then the outage.
    Http::fake([WarningsFeedService::SOURCE_URL => Http::sequence()
        ->push(jardFixture())
        ->push('down', 500)]);
    $first = $this->getJson('/api/mobile/warnings')->assertOk()->json('data.items');

    Cache::forget(WarningsFeedService::CACHE_KEY);
    $response = $this->getJson('/api/mobile/warnings')->assertOk();

    expect($response->json('data.stale'))->toBeTrue()
        ->and($response->json('data.items'))->toBe($first);
});

test('warnings answers 503 when the upstream fails and nothing is cached', function () {
    Http::fake([WarningsFeedService::SOURCE_URL => Http::response('down', 500)]);

    $this->getJson('/api/mobile/warnings')
        ->assertStatus(503)
        ->assertExactJson(['message' => 'Emergency warnings are temporarily unavailable.']);
});

test('warnings answers 503 when the page carries no inertia data', function () {
    Http::fake([WarningsFeedService::SOURCE_URL => Http::response('<html></html>')]);

    $this->getJson('/api/mobile/warnings')->assertStatus(503);
});
