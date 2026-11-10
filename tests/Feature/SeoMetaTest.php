<?php

use App\Models\Poll;
use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Vite;
use Inertia\Ssr\Gateway;
use Inertia\Ssr\Response;

test('server-rendered html includes seo meta and json-ld even when inertia.ssr.enabled is true and ssr server is offline', function () {
    Vite::useHotFile(storage_path('framework/testing/hot-missing'));
    config()->set('inertia.ssr.enabled', true);
    config()->set('inertia.ssr.url', 'http://127.0.0.1:59999');

    $html = $this->get('/about')->assertOk()->getContent();

    expect($html)->toContain('<title inertia>عن المنصة | Syrian Zone</title>')
        ->and($html)->toContain('<link rel="canonical" href="https://syrian.zone/about" inertia>')
        ->and($html)->toContain('<meta property="og:image" content="https://syrian.zone'.StaticCards::url('about').'" inertia>')
        ->and($html)->toContain('<script type="application/ld+json" inertia>');
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

    expect(substr_count($html, '<title'))->toBe(1)
        ->and(substr_count($html, 'property="og:image"'))->toBe(1)
        ->and(substr_count($html, 'rel="canonical"'))->toBe(1)
        ->and(substr_count($html, 'application/ld+json'))->toBe(1)
        ->and($html)->toContain('<title inertia>دليل الهاتف والواتساب الخدمي | Syrian Zone</title>')
        ->and($html)->toContain('<meta property="og:image" content="https://syrian.zone'.StaticCards::url('phonebook').'" inertia>');
});

test('a missing page announces itself as a 404 and is not indexed', function () {
    $html = $this->get('/no-such-page')->assertNotFound()->getContent();

    expect($html)->toContain('<title inertia>الصفحة غير موجودة (404) | Syrian Zone</title>')
        ->and($html)->toContain('<meta name="robots" content="noindex, follow" inertia>')
        ->and($html)->not->toContain('<title inertia>المساحة السورية — منصة سورية مفتوحة المصدر</title>');

    $jsonLd = json_decode(str($html)->betweenFirst('<script type="application/ld+json" inertia>', '</script>')->toString(), true);
    $page = collect($jsonLd['@graph'])->firstWhere('@type', 'WebPage');
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
