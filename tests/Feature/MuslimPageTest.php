<?php

use Inertia\Testing\AssertableInertia as Assert;

test('the muslim hub renders its inertia component', function () {
    $this->get('/muslim')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Muslim/Index'));
});

test('each muslim tool has its own public route', function (string $path, string $component) {
    $this->get($path)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component($component));
})->with([
    ['/muslim/prayer', 'Muslim/Prayer/Index'],
    ['/muslim/quran', 'Muslim/Quran/Index'],
    ['/muslim/radio', 'Muslim/Radio/Index'],
]);

test('legacy ?tab= links redirect to the tool route', function (string $tab, string $path) {
    $this->get("/muslim?tab={$tab}")->assertRedirect($path);
})->with([
    ['prayer', '/muslim/prayer'],
    ['quran', '/muslim/quran'],
    ['radio', '/muslim/radio'],
]);

test('an unknown tab falls back to the hub', function () {
    $this->get('/muslim?tab=nope')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Muslim/Index'));
});

test('an unknown muslim slug is not routed', function () {
    $this->get('/muslim/chess')->assertNotFound();
});
