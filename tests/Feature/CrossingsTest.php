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

test('the crossings page is listed in the sitemap', function () {
    $this->get('/sitemap.xml')
        ->assertOk()
        ->assertSee('https://syrian.zone/crossings', escape: false);
});
