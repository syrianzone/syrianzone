<?php

use App\Support\Seo\Og\CardSource;
use App\Support\Seo\Pages;
use App\Support\Seo\Preview\PreviewResolver;
use App\Support\Seo\Preview\Previews;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/**
 * The page table (resources/data/seo.json) is the single record per public page:
 * path, title, description, share card, og:type, JSON-LD type, breadcrumb parent.
 * These tests assert the rest of the SEO stack derives from it, so a page cannot
 * be added to one half and forgotten in the other.
 */

/** Cards that belong to a share link rather than to a page; they have no path. */
const SHARE_CARDS = ['guesswho-invite', 'priorities-share', 'compass-share'];

function seoPageRoutes(): array
{
    return collect(Route::getRoutes())
        ->filter(fn ($route) => in_array('GET', $route->methods(), true) && ! str_contains($route->uri(), '{'))
        ->map(fn ($route) => '/'.ltrim($route->uri(), '/'))
        ->all();
}

test('every page in the table is a registered GET route, and every page record is complete', function () {
    $routes = seoPageRoutes();

    foreach (Pages::paths() as $path) {
        $page = Pages::get($path);

        expect($routes)->toContain($path)
            ->and($page['title'])->not->toBeEmpty()
            ->and(mb_strlen((string) $page['description']))->toBeGreaterThan(60)
            ->and($page['card'])->not->toBeEmpty();
    }
});

test('one card per page: no page borrows another page\'s card, and no card is left unused', function () {
    $cards = json_decode(file_get_contents(resource_path('og/cards.json')), true, flags: JSON_THROW_ON_ERROR)['cards'];
    $slugs = array_column($cards, 'slug');
    $used = array_values(Pages::cardPaths());

    expect(count($used))->toBe(count(array_unique($used)));

    foreach ($used as $slug) {
        expect($slugs)->toContain($slug);
    }

    $orphans = array_values(array_diff($slugs, $used));
    sort($orphans);
    $share = SHARE_CARDS;
    sort($share);
    expect($orphans)->toBe($share, 'A card is neither used by a page nor listed as a share card.');
});

test('the card artwork no longer repeats the page paths', function () {
    $cards = json_decode(file_get_contents(resource_path('og/cards.json')), true, flags: JSON_THROW_ON_ERROR)['cards'];

    foreach ($cards as $card) {
        expect($card)->not->toHaveKey('paths');
    }
});

test('structured data has the type the page table declares', function () {
    foreach (Pages::paths() as $path) {
        $meta = SeoMeta::resolve(Request::create($path, 'GET'));
        $graph = json_decode($meta['json_ld'], true, flags: JSON_THROW_ON_ERROR)['@graph'];
        $canonical = rtrim((string) config('seo.base_url'), '/').($path === '/' ? '/' : $path);
        $node = collect($graph)->firstWhere('@id', $canonical.'#webpage');

        expect($node, $path)->not->toBeNull()
            ->and($node['@type'])->toBe(Pages::schema($path))
            ->and($meta['type'])->toBe(Pages::type($path))
            ->and($meta['canonical'])->toBe($canonical);
    }
});

test('a breadcrumb parent is a page of the table, and its label is that page\'s name', function () {
    foreach (Pages::paths() as $path) {
        $parent = Pages::parent($path);
        if ($parent === null) {
            continue;
        }

        [$parentPath, $label] = $parent;
        $parentPage = Pages::get($parentPath);

        expect($parentPage, $path)->not->toBeNull()
            ->and($label)->toBe(Pages::get($path)['parentLabel'] ?? $parentPage['title']);
    }
});

test('every preview resolver registers once and names a fallback card that exists', function () {
    $slugs = array_column(
        json_decode(file_get_contents(resource_path('og/cards.json')), true, flags: JSON_THROW_ON_ERROR)['cards'],
        'slug',
    );
    $types = [];

    foreach (Previews::RESOLVERS as $resolver) {
        expect(is_subclass_of($resolver, PreviewResolver::class), $resolver)->toBeTrue();

        if (! is_subclass_of($resolver, CardSource::class)) {
            continue;
        }

        $type = $resolver::cardType();
        $types[] = $type;
        expect($slugs, $resolver)->toContain($resolver::fallbackCard())
            // The card endpoint asks the registry by type, so both directions
            // must name the same class.
            ->and(Previews::cardSource($type))->toBeInstanceOf($resolver);
    }

    expect(count($types))->toBe(count(array_unique($types)));
});
