<?php

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Cache::flush();
});

function recipeItem(int $id, string $name, string $slug, array $overrides = []): array
{
    return array_merge([
        'id' => $id,
        'name' => $name,
        'slug' => $slug,
        'image_url' => "https://food.syrian.zone/storage/recipes/{$slug}.webp",
        'city' => 'غير محدد',
        'city_slug' => 'general',
        'time_needed' => null,
        'difficulty' => 'سهلة',
        'author_name' => 'منتهى أكتع',
        'tags' => [],
    ], $overrides);
}

// Mirrors the live shape: 12 items a page, 8 pages, 90 recipes.
function recipePage(int $page, int $lastPage = 8): array
{
    $recipes = [];
    for ($i = 0; $i < 12; $i++) {
        $n = ($page - 1) * 12 + $i + 1;
        $recipes[] = recipeItem($n, "وصفة {$n}", "recipe-{$n}");
    }

    return [
        'recipes' => $recipes,
        'pagination' => ['current_page' => $page, 'last_page' => $lastPage, 'total' => $lastPage * 12],
    ];
}

function fakeRecipeUpstream(int $lastPage = 8): void
{
    Http::fake(function ($request) use ($lastPage) {
        parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);
        $page = max(1, (int) ($query['page'] ?? 1));

        return Http::response(recipePage($page, $lastPage), 200);
    });
}

test('normalizes a realistic payload', function () {
    Http::fake(['*' => Http::response([
        'recipes' => [recipeItem(134, 'معمول تمر', 'maamol-tmr-1v4hnP', [
            'city' => 'حلب',
            'difficulty' => 'متوسطة',
            'time_needed' => ['تحضير الطبق' => '10 دقائق', 'تحضير الكاسترد' => '20 دقيقة'],
            'tags' => [['id' => 4, 'name' => 'حلويات', 'slug' => 'hloyat']],
        ])],
        'pagination' => ['current_page' => 1, 'last_page' => 1, 'total' => 1],
    ], 200)]);

    $response = $this->getJson('/api/recipe-of-the-day')
        ->assertOk()
        ->assertHeader('Cache-Control', 'max-age=1800, public');

    $response->assertJson(['recipe' => [
        'id' => 134,
        'name' => 'معمول تمر',
        'url' => 'https://food.syrian.zone/recipes/maamol-tmr-1v4hnP',
        'image_url' => 'https://food.syrian.zone/storage/recipes/maamol-tmr-1v4hnP.webp',
        'city' => 'حلب',
        'difficulty' => 'متوسطة',
        'tags' => ['حلويات'],
    ]]);

    $response->assertJsonPath('recipe.time_needed', [
        ['label' => 'تحضير الطبق', 'value' => '10 دقائق'],
        ['label' => 'تحضير الكاسترد', 'value' => '20 دقيقة'],
    ]);
});

// upstream stores an unset city as this literal, which is not worth showing
test('nulls out an unspecified city', function () {
    fakeRecipeUpstream(lastPage: 1);

    $this->getJson('/api/recipe-of-the-day')
        ->assertOk()
        ->assertJsonPath('recipe.city', null);
});

// The core invariant: a widget that reshuffles on refetch is wrong.
test('the same date always yields the same recipe', function () {
    $this->travelTo('2026-07-20 08:00:00');
    fakeRecipeUpstream();

    $first = $this->getJson('/api/recipe-of-the-day')->assertOk()->json('recipe.id');

    // later the same day, with the cache gone, the pick must not move
    Cache::flush();
    $this->travelTo('2026-07-20 23:59:00');

    $second = $this->getJson('/api/recipe-of-the-day')->assertOk()->json('recipe.id');

    expect($second)->toBe($first);
});

test('a different date yields a different pick', function () {
    fakeRecipeUpstream();

    $picks = [];
    foreach (['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24'] as $day) {
        Cache::flush();
        $this->travelTo("{$day} 09:00:00");
        $picks[] = $this->getJson('/api/recipe-of-the-day')->assertOk()->json('recipe.id');
    }

    // over a 90 recipe pool five consecutive days must not all land on one recipe
    expect(array_unique($picks))->toHaveCount(count($picks));
});

test('caches a successful response instead of refetching', function () {
    $this->travelTo('2026-07-20 08:00:00');
    Http::fake(['*' => Http::response(recipePage(1, 1), 200)]);

    $this->getJson('/api/recipe-of-the-day')->assertOk();
    $this->getJson('/api/recipe-of-the-day')->assertOk();

    Http::assertSentCount(1);
});

test('the cache expires with the day', function () {
    $this->travelTo('2026-07-20 08:00:00');
    fakeRecipeUpstream();

    $before = $this->getJson('/api/recipe-of-the-day')->assertOk()->json('recipe.id');

    // no flush: crossing midnight alone must produce a fresh pick
    $this->travelTo('2026-07-21 00:05:00');

    $after = $this->getJson('/api/recipe-of-the-day')->assertOk()->json('recipe.id');

    expect($after)->not->toBe($before);
});

// A transient upstream failure must not be cached, or it serves all day.
test('does not cache upstream failures', function () {
    $this->travelTo('2026-07-20 08:00:00');

    // fakeSequence, not a second Http::fake call: re-faking does not reliably
    // replace a stub, so the retry would keep seeing the 500
    Http::fakeSequence()
        ->push('nope', 500)
        ->pushResponse(Http::response(recipePage(1, 1), 200));

    $this->getJson('/api/recipe-of-the-day')
        ->assertStatus(502)
        ->assertJsonPath('message', 'تعذر تحميل وصفة اليوم');

    // the retry reaches upstream, which it could not do if the 500 had been cached
    $this->getJson('/api/recipe-of-the-day')->assertOk();
});

test('returns 502 when upstream has no recipes', function () {
    Http::fake(['*' => Http::response([
        'recipes' => [],
        'pagination' => ['current_page' => 1, 'last_page' => 1, 'total' => 0],
    ], 200)]);

    $this->getJson('/api/recipe-of-the-day')
        ->assertStatus(502)
        ->assertJsonPath('message', 'تعذر تحميل وصفة اليوم');
});

test('returns 502 for a malformed upstream payload', function () {
    Http::fake(['*' => Http::response(['unexpected' => true], 200)]);

    $this->getJson('/api/recipe-of-the-day')->assertStatus(502);
});

test('handles an upstream connection error', function () {
    Http::fake(fn () => throw new ConnectionException('timeout'));

    $this->getJson('/api/recipe-of-the-day')->assertStatus(502);
});
