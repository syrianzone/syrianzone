<?php

use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;
use Illuminate\Routing\RedirectController;
use Illuminate\Support\Facades\Route;

/**
 * Routes that answer GET without being a page: endpoints, and shims that only
 * redirect. A new public page does not belong here; give it an entry instead.
 */
const NOT_PAGES = ['healthcheck', 'sitemap.xml', 'llms.txt', 'broadcasting/auth', 'sanctum/csrf-cookie', 'places'];

test('every public page declares its own title, description and share card', function () {
    $missing = [];

    foreach (Route::getRoutes() as $route) {
        $uri = $route->uri();

        if (! in_array('GET', $route->methods(), true)
            || str_contains($uri, '{')
            || ! in_array('web', $route->gatherMiddleware(), true)
            || str_starts_with($uri, 'api/')
            || in_array($uri, NOT_PAGES, true)
            || ltrim((string) $route->getControllerClass(), '\\') === RedirectController::class) {
            continue;
        }

        $path = '/'.ltrim($uri, '/');

        // Signed-in and internal areas are reachable but never indexed or
        // shared; they get the site defaults on purpose.
        if (SeoMeta::resolve(Request::create($path, 'GET'))['robots'] === 'noindex, follow') {
            continue;
        }

        if (! in_array($path, SeoMeta::pagePaths(), true) || StaticCards::forPath($path) === null) {
            $missing[] = $path;
        }
    }

    expect($missing)->toBe(
        [],
        'These public pages would be shared with the generic site preview. Add each one to SeoMeta::PAGES and '
        .'resources/og/cards.json, then run `npm run og:build` (see docs/guidelines/seo.md): '.implode(', ', $missing),
    );
});
