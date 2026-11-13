<?php

use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\Pages;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;
use Illuminate\Routing\RedirectController;
use Illuminate\Support\Facades\Route;

/**
 * The GET routes that answer without being a page: endpoints and redirect shims.
 * The list itself is data (`non_pages` in resources/data/seo.json) so the route
 * inventory lives in one place; a new public page does not belong there, give it
 * a record instead.
 */
test('every public page declares its own title, description and share card', function () {
    $missing = [];

    foreach (Route::getRoutes() as $route) {
        $uri = $route->uri();

        if (! in_array('GET', $route->methods(), true)
            || str_contains($uri, '{')
            || ! in_array('web', $route->gatherMiddleware(), true)
            || str_starts_with($uri, 'api/')
            || in_array($uri, Pages::nonPages(), true)
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
        'These public pages would be shared with the generic site preview. Add one record each to '
        .'resources/data/seo.json, then run `npm run og:build` (see docs/guidelines/seo.md): '.implode(', ', $missing),
    );
});

test('the non-page list names routes that still exist', function () {
    $routes = collect(Route::getRoutes())
        ->filter(fn ($route) => in_array('GET', $route->methods(), true))
        ->map(fn ($route) => $route->uri())
        ->all();

    foreach (Pages::nonPages() as $uri) {
        expect($routes)->toContain($uri);
    }
});
