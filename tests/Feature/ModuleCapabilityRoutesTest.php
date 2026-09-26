<?php

use App\Http\Middleware\GovAppsAdmin;
use App\Http\Middleware\ModuleCapabilityGuard;
use App\Http\Middleware\PhonebookAdmin;
use App\Http\Middleware\PlacesAdmin;
use App\Http\Middleware\PollsAdmin;
use App\Http\Middleware\SyOfficialAdmin;
use App\Http\Middleware\TransitAdmin;
use App\Http\Middleware\UsersAdmin;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Per-capability admin route enforcement
|--------------------------------------------------------------------------
|
| Every module middleware used to grant the whole module to anyone holding any
| one capability in it, so a `phonebook.reorder`-only user could delete phonebook
| entries and a `polls.create`-only user could delete polls — while the Filament
| form showed five and three independent checkboxes implying otherwise. The
| middlewares now extend ModuleCapabilityGuard and each route names the
| capability it needs.
|
| These tests are the safety net for the fix. Because the guard DENIES an
| untagged route, forgetting a tag breaks a feature rather than silently
| over-granting, which is the safe direction to fail — but it is still a
| regression, so the route table itself is asserted here:
|
|  1. no route inside a guarded group is left untagged,
|  2. every tag is a real capability, so a typo cannot silently deny a route,
|  3. no mutating route is tagged `any`, which would reintroduce the blanket.
|
*/

$guarded = [
    'polls_admin' => 'polls',
    'places_admin' => 'places',
    'syofficial_admin' => 'syofficial',
    'govapps_admin' => 'govapps',
    'phonebook_admin' => 'phonebook',
    'transit_admin' => 'transit',
    'users_admin' => 'users',
];

it('leaves no route inside a guarded admin group without a capability', function () use ($guarded) {
    $offenders = [];

    foreach (Route::getRoutes() as $route) {
        $middleware = $route->gatherMiddleware();

        foreach ($guarded as $alias) {
            // The group itself is declared as the bare alias, e.g.
            // 'polls_admin'. A parameterised instance, 'polls_admin:polls.edit',
            // is the per-route tag we are looking for.
            if (! in_array($alias, $middleware, true)) {
                continue;
            }

            $tagged = array_filter(
                $middleware,
                fn (string $m) => str_starts_with($m, $alias.':')
            );

            if ($tagged === []) {
                $offenders[] = sprintf(
                    'UN-TAGGED  %s %s',
                    implode('|', $route->methods()),
                    $route->uri()
                );
            }
        }
    }

    expect($offenders)->toBe([]);
})->skipOnWindows();

it('never tags a mutating route with the any sentinel', function () use ($guarded) {
    $offenders = [];

    foreach (Route::getRoutes() as $route) {
        $methods = array_diff($route->methods(), ['GET', 'HEAD', 'OPTIONS']);

        if ($methods === []) {
            continue;
        }

        foreach ($guarded as $alias => $module) {
            $tag = $alias.':'.ModuleCapabilityGuard::ANY;

            if (in_array($tag, $route->gatherMiddleware(), true)) {
                $offenders[] = sprintf(
                    '%s %s is tagged "any" but mutates data',
                    implode('|', $route->methods()),
                    $route->uri()
                );
            }
        }
    }

    expect($offenders)->toBe([]);
});

it('only ever tags routes with real capabilities', function () use ($guarded) {
    $offenders = [];

    foreach (Route::getRoutes() as $route) {
        foreach ($route->gatherMiddleware() as $m) {
            foreach ($guarded as $alias => $module) {
                if (! str_starts_with($m, $alias.':')) {
                    continue;
                }

                $capability = substr($m, strlen($alias) + 1);

                // `any` is the sentinel, not a capability.
                if ($capability === ModuleCapabilityGuard::ANY) {
                    continue;
                }

                if (! PermissionCatalogue::isKnown($capability)) {
                    $offenders[] = sprintf(
                        '%s %s tags unknown capability "%s"',
                        implode('|', $route->methods()),
                        $route->uri(),
                        $capability
                    );
                }

                // A tag must also belong to the module whose middleware is
                // being used, otherwise `polls_admin:phonebook.delete` would
                // grant access to the wrong capability entirely.
                if (PermissionCatalogue::isKnown($capability)
                    && ! str_starts_with($capability, $module.'.')) {
                    $offenders[] = sprintf(
                        '%s %s uses %s to require "%s", which belongs to another module',
                        implode('|', $route->methods()),
                        $route->uri(),
                        $alias,
                        $capability
                    );
                }
            }
        }
    }

    expect($offenders)->toBe([]);
});

it('declares only real capabilities in each middleware', function () {
    $middlewares = [
        PollsAdmin::class,
        PlacesAdmin::class,
        SyOfficialAdmin::class,
        GovAppsAdmin::class,
        PhonebookAdmin::class,
        TransitAdmin::class,
        UsersAdmin::class,
    ];

    foreach ($middlewares as $class) {
        $middleware = new $class;
        $middleware->assertCapabilitiesAreReal();
    }

    expect(true)->toBeTrue();
});

it('registers every guard under the alias it declares', function () {
    // The guard's bare group instance looks for its own alias when deciding
    // whether a route is tagged. A mismatch between alias() and the alias
    // table is silent and would 403 every route in the module, so it is
    // asserted rather than trusted.
    $registered = app('router')->getMiddleware();

    $middlewares = [
        PollsAdmin::class,
        PlacesAdmin::class,
        SyOfficialAdmin::class,
        GovAppsAdmin::class,
        PhonebookAdmin::class,
        TransitAdmin::class,
        UsersAdmin::class,
    ];

    foreach ($middlewares as $class) {
        $alias = (new $class)->alias();

        expect($registered[$alias] ?? null)->toBe(
            $class,
            sprintf('%s declares alias "%s" but bootstrap/app.php registers something else.', $class, $alias)
        );
    }
});
