<?php

use Inertia\Testing\AssertableInertia as Assert;

test('the games hub is public', function () {
    $this->get('/games')->assertOk();
});

test('the games hub renders its inertia component', function () {
    $this->get('/games')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Games/Index'));
});

test('each game has its own public route', function (string $path, string $component) {
    $this->get($path)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component($component));
})->with([
    ['/games/2048', 'Games/2048/Index'],
    ['/games/solitare', 'Games/Solitare/Index'],
    ['/games/tarneeb', 'Games/Tarneeb/Index'],
]);

test('an unknown game slug is not routed', function () {
    $this->get('/games/chess')->assertNotFound();
});

test('every games route is a public closure with no middleware', function () {
    foreach (['games', 'games/2048', 'games/solitare', 'games/tarneeb'] as $path) {
        $route = collect(app('router')->getRoutes()->getRoutes())
            ->first(fn ($r) => $r->uri() === $path && in_array('GET', $r->methods(), true));

        expect($route)->not->toBeNull("missing route: {$path}");
        // A Closure means there is no controller to bypass, and 'web' is the
        // only stack — no auth, throttle or role gate to bolt on by accident.
        expect($route->getAction('uses'))->toBeInstanceOf(Closure::class);
        expect($route->gatherMiddleware())->toBe(['web']);
    }
});
