<?php

use App\Support\Facts;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| The promises admin sections
|--------------------------------------------------------------------------
|
| `resources/data/promises-admin-sections.json` is the one record of the four
| sections: the page each nav entry links to and the capability that page's
| route requires. The nav reads it (Pages/Admin/Promises/_lib/sections.ts) and
| so does this test, so a link can never be shown to an account whose route
| would refuse it, and a route tag cannot move without the nav following.
|
*/

/**
 * The `promises_admin` guard a GET route carries: the last argument the
 * middleware stack names, which is the route's own (the group adds the bare
 * `promises_admin` = `any`, the route narrows it), or null when untagged.
 */
function promisesAdminGuard(string $uri): ?string
{
    $route = Route::getRoutes()->match(Request::create($uri, 'GET'));

    $guard = null;
    foreach ($route->gatherMiddleware() as $middleware) {
        if (str_starts_with((string) $middleware, 'promises_admin')) {
            $guard = str_contains((string) $middleware, ':')
                ? explode(':', (string) $middleware, 2)[1]
                : 'any';
        }
    }

    return $guard;
}

test('every promises admin section page is tagged with the capability its nav entry gates on', function () {
    $sections = Facts::json('promises-admin-sections');

    expect($sections)->toHaveCount(4);

    foreach ($sections as $key => $section) {
        expect(promisesAdminGuard($section['page']))
            ->toBe($section['capability'], "section \"{$key}\" ({$section['page']})");
    }
});

test('the sector routes are guarded by the same capability as the sectors nav entry', function () {
    // One section, six routes: the page and the five sector APIs. The nav's
    // gate is the table's, so this is the assertion that they cannot diverge.
    $capability = Facts::json('promises-admin-sections')['sectors']['capability'];

    $sectorRoutes = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($route) => str_contains($route->uri(), 'promises/sectors'))
        ->mapWithKeys(function ($route) {
            $guard = null;
            foreach ($route->gatherMiddleware() as $middleware) {
                if (str_starts_with((string) $middleware, 'promises_admin')) {
                    $guard = str_contains((string) $middleware, ':')
                        ? explode(':', (string) $middleware, 2)[1]
                        : 'any';
                }
            }

            return [$route->uri() => $guard];
        });

    expect($sectorRoutes)->not->toBeEmpty();

    foreach ($sectorRoutes as $uri => $guard) {
        expect($guard)->toBe($capability, $uri);
    }
});
