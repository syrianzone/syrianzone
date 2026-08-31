<?php

use Inertia\Testing\AssertableInertia as Assert;

test('the crossings page is public', function () {
    $this->get('/crossings')->assertOk();
});

test('the crossings page renders its inertia component', function () {
    $this->get('/crossings')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Crossings/Index'));
});

test('inertia resolves pages from the tracked case-sensitive directory', function () {
    expect(config('inertia.pages.paths'))->toBe([
        resource_path('js/Pages'),
    ]);
});

test('the crossings page is listed in the sitemap', function () {
    $this->get('/sitemap.xml')
        ->assertOk()
        ->assertSee('https://syrian.zone/crossings', escape: false);
});
