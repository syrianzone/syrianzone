<?php

use Inertia\Testing\AssertableInertia as Assert;

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
    ['/games/trix', 'Games/Trix/Index'],
]);

test('an unknown game slug is not routed', function () {
    $this->get('/games/chess')->assertNotFound();
});
