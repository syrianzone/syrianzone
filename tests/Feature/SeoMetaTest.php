<?php

use App\Models\Poll;
use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Vite;
use Inertia\Ssr\Gateway;
use Inertia\Ssr\Response;

/**
 * The head of a server-rendered page, as the values a crawler reads.
 *
 * `meta` and `links` are keyed by property/name/rel, so an assertion says which
 * preview field must carry which value rather than which tag string was
 * printed. `json_ld` holds every structured-data block, decoded.
 *
 * @return array{meta: array<string, string>, links: array<string, string>, title: string, json_ld: array<int, mixed>}
 */
function seoHeadTags(string $html): array
{
    $attributesOf = function (string $source): array {
        preg_match_all('/([a-zA-Z:-]+)="([^"]*)"/', $source, $pairs, PREG_SET_ORDER);

        return array_column($pairs, 2, 1);
    };

    $meta = [];
    preg_match_all('/<meta\b([^>]*)>/i', $html, $metaTags);
    foreach ($metaTags[1] as $source) {
        $tag = $attributesOf($source);
        $key = $tag['property'] ?? $tag['name'] ?? null;
        if ($key !== null) {
            $meta[$key] = $tag['content'] ?? '';
        }
    }

    $links = [];
    preg_match_all('/<link\b([^>]*)>/i', $html, $linkTags);
    foreach ($linkTags[1] as $source) {
        $tag = $attributesOf($source);
        if (isset($tag['rel'])) {
            $links[$tag['rel']] = $tag['href'] ?? '';
        }
    }

    $jsonLd = [];
    preg_match_all('/<script\b[^>]*application\/ld\+json[^>]*>(.*?)<\/script>/is', $html, $blocks);
    foreach ($blocks[1] as $block) {
        $decoded = json_decode(trim($block), true);
        if (is_array($decoded)) {
            $jsonLd[] = $decoded;
        }
    }

    preg_match('/<title\b[^>]*>(.*?)<\/title>/is', $html, $title);

    return [
        'meta' => $meta,
        'links' => $links,
        'title' => html_entity_decode($title[1] ?? '', ENT_QUOTES | ENT_HTML5),
        'json_ld' => $jsonLd,
    ];
}

test('server-rendered html includes seo meta and json-ld even when inertia.ssr.enabled is true and ssr server is offline', function () {
    Vite::useHotFile(storage_path('framework/testing/hot-missing'));
    config()->set('inertia.ssr.enabled', true);
    config()->set('inertia.ssr.url', 'http://127.0.0.1:59999');

    $head = seoHeadTags($this->get('/about')->assertOk()->getContent());

    expect($head['title'])->toBe('عن المنصة | Syrian Zone')
        ->and($head['links']['canonical'])->toBe('https://syrian.zone/about')
        ->and($head['meta']['og:image'])->toBe('https://syrian.zone'.StaticCards::url('about'))
        ->and($head['json_ld'])->not->toBe([]);
});

test('head tags are printed once even when ssr succeeds but the page rendered nothing', function () {
    // A page that returns nothing on its first server render (a "mounted"
    // guard, a loading state) leaves the SSR head empty. The tags must not
    // depend on it: this is what left /phonebook without any preview.
    $this->app->bind(Gateway::class, fn () => new class implements Gateway
    {
        public function dispatch(array $page): ?Response
        {
            return new Response('', '<div id="app"></div>');
        }
    });

    $html = $this->get('/phonebook')->assertOk()->getContent();
    $head = seoHeadTags($html);

    expect(substr_count($html, '<title'))->toBe(1)
        ->and(substr_count($html, 'property="og:image"'))->toBe(1)
        ->and(substr_count($html, 'rel="canonical"'))->toBe(1)
        ->and(substr_count($html, 'application/ld+json'))->toBe(1)
        ->and($head['title'])->toBe('دليل الهاتف والواتساب الخدمي | Syrian Zone')
        ->and($head['meta']['og:image'])->toBe('https://syrian.zone'.StaticCards::url('phonebook'));
});

test('a missing page announces itself as a 404 and is not indexed', function () {
    $head = seoHeadTags($this->get('/no-such-page')->assertNotFound()->getContent());

    expect($head['title'])->toBe('الصفحة غير موجودة (404) | Syrian Zone')
        ->and($head['meta']['robots'])->toBe('noindex, follow');

    $page = collect($head['json_ld'][0]['@graph'])->firstWhere('@type', 'WebPage');
    expect($page['name'])->toBe('الصفحة غير موجودة (404) | Syrian Zone');
});

test('poll show and leaderboard routes resolve distinct metadata and canonicals', function () {
    $poll = Poll::factory()->create([
        'slug' => 'governors-2026',
        'title' => 'تقييم المحافظين',
        'is_active' => true,
    ]);

    $showMeta = SeoMeta::resolve(Request::create('/polls/governors-2026', 'GET'));
    $lbMeta = SeoMeta::resolve(Request::create('/polls/governors-2026/leaderboard', 'GET'));

    expect($showMeta['title'])->toBe('تقييم المحافظين | استطلاعات سوريا زون')
        ->and($showMeta['canonical'])->toBe('https://syrian.zone/polls/governors-2026')
        ->and($showMeta['robots'])->toBe('index, follow')
        ->and($lbMeta['title'])->toBe('نتائج تقييم المحافظين | استطلاعات سوريا زون')
        ->and($lbMeta['canonical'])->toBe('https://syrian.zone/polls/governors-2026/leaderboard')
        ->and($lbMeta['robots'])->toBe('index, follow');

    // Accessing by UUID canonicalizes to the slug URL
    $uuidMeta = SeoMeta::resolve(Request::create('/polls/'.$poll->id, 'GET'));
    expect($uuidMeta['canonical'])->toBe('https://syrian.zone/polls/governors-2026');
});

test('best-ministers poll alias canonicalizes to /tierlist and /tierlist/leaderboard', function () {
    Poll::factory()->create([
        'slug' => 'best-ministers',
        'title' => 'تقييم الوزراء',
        'is_active' => true,
    ]);

    $showMeta = SeoMeta::resolve(Request::create('/polls/best-ministers', 'GET'));
    $lbMeta = SeoMeta::resolve(Request::create('/polls/best-ministers/leaderboard', 'GET'));

    expect($showMeta['canonical'])->toBe('https://syrian.zone/tierlist')
        ->and($lbMeta['canonical'])->toBe('https://syrian.zone/tierlist/leaderboard');
});

test('inactive polls and compass share pages resolve to noindex, follow', function () {
    Poll::factory()->create([
        'slug' => 'closed-poll',
        'title' => 'استطلاع منتهي',
        'is_active' => false,
    ]);

    $pollMeta = SeoMeta::resolve(Request::create('/polls/closed-poll', 'GET'));
    $compassShareMeta = SeoMeta::resolve(Request::create('/compass/s/abc123xyz', 'GET'));
    $transitAdminMeta = SeoMeta::resolve(Request::create('/transit/admin', 'GET'));

    expect($pollMeta['robots'])->toBe('noindex, follow')
        ->and($compassShareMeta['robots'])->toBe('noindex, follow')
        ->and($compassShareMeta['title'])->toContain('نتيجة مشتركة')
        ->and($transitAdminMeta['robots'])->toBe('noindex, follow');
});

test('nested routes emit 3-level BreadcrumbList in JSON-LD', function () {
    $meta = SeoMeta::resolve(Request::create('/muslim/quran', 'GET'));
    $decoded = json_decode($meta['json_ld'], true);

    $breadcrumbs = collect($decoded['@graph'])->firstWhere('@type', 'BreadcrumbList');

    expect($breadcrumbs)->not->toBeNull()
        ->and($breadcrumbs['itemListElement'])->toHaveCount(3)
        ->and($breadcrumbs['itemListElement'][0]['item'])->toBe('https://syrian.zone/')
        ->and($breadcrumbs['itemListElement'][1]['item'])->toBe('https://syrian.zone/muslim')
        ->and($breadcrumbs['itemListElement'][2]['item'])->toBe('https://syrian.zone/muslim/quran');
});

test('non-existent transit city returns 404 instead of a soft-404 200', function () {
    $this->get('/transit/city/not-a-real-city-123')->assertNotFound();
});

test('the organization and website carry the arabic name and the project profiles', function () {
    $graph = collect(json_decode(SeoMeta::resolve(Request::create('/', 'GET'))['json_ld'], true)['@graph']);

    expect($graph->firstWhere('@type', 'Organization'))
        ->toMatchArray(['alternateName' => 'المساحة السورية', 'sameAs' => config('seo.same_as')])
        ->and($graph->firstWhere('@type', 'WebSite')['alternateName'])->toBe('المساحة السورية');
});

test('a fixed page keeps dates out of its structured data', function () {
    $page = collect(json_decode(SeoMeta::resolve(Request::create('/house', 'GET'))['json_ld'], true)['@graph'])
        ->firstWhere('@type', 'Article');

    expect($page['headline'])->toBe('المجلس التشريعي السوري 2026')
        ->and($page)->not->toHaveKeys(['datePublished', 'dateModified']);
});
