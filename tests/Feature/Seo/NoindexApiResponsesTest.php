<?php

/**
 * JSON under /api tells crawlers not to index it, without robots.txt blocking
 * it (a rendering crawler still needs to fetch it). Pages are unaffected.
 */
test('json answered under /api carries X-Robots-Tag: noindex', function () {
    $this->getJson('/api/v1/navigation')
        ->assertOk()
        ->assertHeader('X-Robots-Tag', 'noindex');
});

test('an /api error answer is marked noindex too', function () {
    $this->getJson('/api/v1/this-route-does-not-exist')
        ->assertNotFound()
        ->assertHeader('X-Robots-Tag', 'noindex');
});

test('pages and the sitemap carry no X-Robots-Tag', function () {
    $this->get('/about')->assertOk()->assertHeaderMissing('X-Robots-Tag');
    $this->get('/sitemap.xml')->assertOk()->assertHeaderMissing('X-Robots-Tag');
});
