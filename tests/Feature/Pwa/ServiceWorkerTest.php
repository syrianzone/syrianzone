<?php

use Illuminate\Routing\Route as RoutingRoute;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

/**
 * The service worker is a static file, so it cannot import the route table. These
 * tests read its path literals out of `public/sw.js` and assert them against the
 * live routes: a renamed route, a dead prefix or a new signed-in area fails here
 * instead of silently degrading the offline behaviour.
 */

/** The source of public/sw.js. */
function serviceWorkerSource(): string
{
    return (string) file_get_contents(public_path('sw.js'));
}

/**
 * The single-quoted strings of one `const NAME = [ ... ];` array in sw.js.
 *
 * @return list<string>
 */
function serviceWorkerList(string $name): array
{
    $source = serviceWorkerSource();
    if (! preg_match('/const '.preg_quote($name, '/').' = \[(.*?)\];/s', $source, $match)) {
        throw new RuntimeException("public/sw.js has no `const {$name} = [ ... ];` list.");
    }

    preg_match_all("/'([^']+)'/", $match[1], $values);

    return $values[1];
}

/** The regex sources of `const OFFLINE_API_PATTERNS`, as PCRE patterns. */
function serviceWorkerPatterns(): array
{
    $source = serviceWorkerSource();
    if (! preg_match('/const OFFLINE_API_PATTERNS = \[(.*?)\];/s', $source, $match)) {
        throw new RuntimeException('public/sw.js has no `const OFFLINE_API_PATTERNS = [ ... ];` list.');
    }

    preg_match_all('#/(\^.*\$)/#', $match[1], $patterns);

    return array_map(fn (string $body) => '~'.$body.'~', $patterns[1]);
}

/** @return array<string, RoutingRoute> uri => route, for every GET route */
function serviceWorkerRoutes(): array
{
    $routes = [];
    foreach (Route::getRoutes() as $route) {
        foreach ($route->methods() as $method) {
            if ($method === 'GET') {
                $routes[$route->uri()] = $route;
            }
        }
    }

    return $routes;
}

/** The route URI of a service-worker path: `/muslim` is the route `muslim`. */
function serviceWorkerRouteUri(string $path): string
{
    return $path === '/' ? '/' : ltrim($path, '/');
}

/** A concrete request path for a route URI: `/a/{b}/c` becomes `/a/1/c`. */
function serviceWorkerSamplePath(string $uri): string
{
    return '/'.preg_replace('/\{[^}]+\}/', '1', $uri);
}

test('every precached page and asset exists', function () {
    $routes = serviceWorkerRoutes();

    foreach (serviceWorkerList('PRECACHE_PAGES') as $path) {
        expect(array_key_exists(serviceWorkerRouteUri($path), $routes))
            ->toBeTrue("public/sw.js precaches {$path}, which is not a registered GET route.");
    }

    foreach (serviceWorkerList('PRECACHE_ASSETS') as $path) {
        expect(public_path(ltrim($path, '/')))->toBeFile();
    }
});

test('every immutable prefix is a public directory', function () {
    foreach (serviceWorkerList('IMMUTABLE_PATH_PREFIXES') as $prefix) {
        expect(public_path(trim($prefix, '/')))->toBeDirectory();
    }
});

test('every offline API path is a registered route the client calls', function () {
    $routes = serviceWorkerRoutes();

    foreach (serviceWorkerList('OFFLINE_API_PATHS') as $path) {
        expect(array_key_exists(serviceWorkerRouteUri($path), $routes))
            ->toBeTrue("public/sw.js caches {$path}, which is not a registered GET route.");
    }

    // One authenticated read is offline-readable on purpose (the Quran reader's
    // bookmarks, which the reader shows without a network). Any other signed-in
    // API in this list would cache a private response.
    $private = ['api/v1/quran-bookmarks'];
    foreach (serviceWorkerList('OFFLINE_API_PATHS') as $path) {
        $route = $routes[serviceWorkerRouteUri($path)] ?? null;
        if ($route === null) {
            continue;
        }
        $authenticated = collect($route->gatherMiddleware())->contains(
            fn ($middleware) => is_string($middleware)
                && (str_starts_with($middleware, 'auth:') || str_contains($middleware, 'Authenticate')),
        );
        if (! $authenticated) {
            continue;
        }

        expect(in_array(serviceWorkerRouteUri($path), $private, true))
            ->toBeTrue("public/sw.js caches the signed-in API {$path}.");
    }

    foreach (serviceWorkerList('OFFLINE_BUILD_PATHS') as $path) {
        // Bundle output only exists after a build, so it is asserted by shape.
        expect($path)->toStartWith('/build/');
    }
});

test('every offline API pattern matches a real route', function () {
    $samples = array_map(fn (string $uri) => serviceWorkerSamplePath($uri), array_keys(serviceWorkerRoutes()));

    foreach (serviceWorkerPatterns() as $pattern) {
        $matched = array_values(array_filter($samples, fn (string $path) => preg_match($pattern, $path) === 1));

        expect($matched)->not->toBe([], "public/sw.js pattern {$pattern} matches no registered route.");
    }
});

test('the no-cache list covers every signed-in area and names no dead prefix', function () {
    $routes = serviceWorkerRoutes();
    $prefixes = serviceWorkerList('NO_CACHE_PREFIXES');

    foreach ($prefixes as $prefix) {
        $relative = trim($prefix, '/');
        $covered = array_filter(
            array_keys($routes),
            fn (string $uri) => $uri === $relative || Str::startsWith($uri, $relative.'/'),
        );
        expect($covered)->not->toBe([], "public/sw.js refuses to cache {$prefix}, which matches no route.");
    }

    // A page behind an authentication middleware must never be cached, whichever
    // mechanism (Laravel's `auth`, Sanctum, or a panel's own Authenticate) guards
    // it. API routes are answered by isOfflineReadableApi, not this list.
    foreach ($routes as $uri => $route) {
        if (str_starts_with($uri, 'api/')) {
            continue;
        }

        $authenticated = collect($route->gatherMiddleware())->contains(
            fn ($middleware) => is_string($middleware)
                && (str_starts_with($middleware, 'auth:') || str_contains($middleware, 'Authenticate')),
        );
        if (! $authenticated) {
            continue;
        }

        $covered = collect($prefixes)->contains(
            fn (string $prefix) => '/'.$uri === $prefix || Str::startsWith('/'.$uri, $prefix),
        );

        expect($covered)->toBeTrue("public/sw.js may cache the signed-in route /{$uri}; add its prefix to NO_CACHE_PREFIXES.");
    }
});

test('the service worker still parses', function () {
    $node = Process::run(['node', '--version']);
    if ($node->failed()) {
        $this->markTestSkipped('Node is not installed.');
    }

    $result = Process::path(base_path())->run(['node', '--check', 'public/sw.js']);

    expect($result->exitCode())->toBe(0, $result->errorOutput());
});
