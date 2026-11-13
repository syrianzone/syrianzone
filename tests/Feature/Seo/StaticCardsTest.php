<?php

use App\Models\Poll;
use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Process;

test('every fixed page has a share card of its own', function () {
    $paths = StaticCards::paths();

    foreach (SeoMeta::pagePaths() as $path) {
        expect($paths)->toHaveKey($path);
    }

    // No page borrows another page's card.
    expect(array_unique(array_values($paths)))->toHaveCount(count($paths));
});

test('every share card is a committed 1200x630 png matching its manifest hash', function () {
    $versions = StaticCards::versions();
    $slugs = collect(json_decode(file_get_contents(resource_path('og/cards.json')), true)['cards'])->pluck('slug');

    expect($slugs)->not->toBeEmpty();

    foreach ($slugs as $slug) {
        $file = StaticCards::file($slug);

        expect(is_file($file))->toBeTrue("public/og/{$slug}.png is missing; run `npm run og:build`");

        [$width, $height, $type] = getimagesize($file);
        expect([$width, $height, $type])->toBe([1200, 630, IMAGETYPE_PNG])
            ->and($versions[$slug] ?? null)->toBe(substr(sha1_file($file), 0, 10));
    }

    // And nothing is left behind from a page that no longer exists.
    $onDisk = collect(glob(public_path('og/*.png')))->map(fn ($file) => basename($file, '.png'));
    expect($onDisk->diff($slugs)->values()->all())->toBe([]);
});

test('a page advertises its card with a version so a redrawn card is fetched again', function () {
    $meta = SeoMeta::resolve(Request::create('/promises', 'GET'));

    expect($meta['image'])->toBe('https://syrian.zone/og/promises.png?v='.StaticCards::versions()['promises']);
});

test('a page without an entry falls back to the site card', function () {
    $meta = SeoMeta::resolve(Request::create('/some/unknown/page', 'GET'));

    expect($meta['image'])->toBe('https://syrian.zone'.StaticCards::url(StaticCards::DEFAULT))
        ->and($meta['title'])->toBe(config('seo.default_title'));
});

test('the committed cards are up to date with their copy, templates and artwork', function () {
    $node = Process::run(['node', '--version']);
    if ($node->failed() || ! is_dir(base_path('node_modules/@resvg/resvg-wasm'))) {
        $this->markTestSkipped('Node and the card renderer are not installed.');
    }

    $check = Process::path(base_path())->timeout(120)->run(['node', 'scripts/og/build.mjs', '--check']);

    expect($check->exitCode())->toBe(0, $check->errorOutput() ?: $check->output());
});

test('a link preview shows the page name alone; the browser tab adds the site name', function () {
    foreach (SeoMeta::pagePaths() as $path) {
        $meta = SeoMeta::resolve(Request::create($path, 'GET'));

        if ($path === '/') {
            expect($meta['title'])->toBe($meta['og_title']);

            continue;
        }

        expect($meta['title'])->toBe($meta['og_title'].' | Syrian Zone')
            ->and($meta['og_title'])->not->toContain('Syrian Zone')->not->toContain('syrian.zone');
    }
});

test('record previews show the record name without its section suffix', function () {
    $poll = Poll::factory()->create(['slug' => 'governors', 'title' => 'تقييم المحافظين']);
    $meta = SeoMeta::resolve(Request::create('/polls/governors', 'GET'));

    expect($meta['title'])->toBe('تقييم المحافظين | استطلاعات سوريا زون')
        ->and($meta['og_title'])->toBe('تقييم المحافظين');
});

/**
 * The tags a link scraper reads, parsed into values keyed by property/name/rel.
 *
 * A crawler depends on `property`/`name`/`rel` paired with their value, not on
 * attribute order or on the marker attributes the framework adds, so the head is
 * read as a map rather than matched against tag strings.
 *
 * @return array{meta: array<string, string>, links: array<string, string>, title: string}
 */
function staticCardHead(string $html): array
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

    preg_match('/<title\b[^>]*>(.*?)<\/title>/is', $html, $title);

    return [
        'meta' => $meta,
        'links' => $links,
        'title' => html_entity_decode($title[1] ?? '', ENT_QUOTES | ENT_HTML5),
    ];
}

test('the head declares the card type and size, and the site account', function () {
    $head = staticCardHead($this->get('/promises')->assertOk()->getContent());

    expect($head['meta']['og:image:type'])->toBe('image/png')
        ->and($head['meta']['og:image:width'])->toBe('1200')
        ->and($head['meta']['og:image:height'])->toBe('630')
        ->and($head['meta']['twitter:site'])->toBe('@SyrianZone')
        ->and($head['meta']['og:title'])->toBe('عداد الوعود')
        ->and($head['title'])->toBe('عداد الوعود | Syrian Zone');
});

test('a missing page previews with its own title too', function () {
    $head = staticCardHead($this->get('/no-such-page')->assertNotFound()->getContent());

    expect($head['meta']['og:title'])->toBe('الصفحة غير موجودة (404)');
});
