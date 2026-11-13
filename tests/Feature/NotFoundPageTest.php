<?php

use Inertia\Testing\AssertableInertia as Assert;

/*
|--------------------------------------------------------------------------
| The 404 page
|--------------------------------------------------------------------------
|
| A 404 is rendered from the exception handler, after the web middleware group
| has unwound, so these tests pin what the handler must replay: the Inertia page
| itself, the shared props and the security headers. Which of the four 404
| variants a visitor sees is decided by the page from its own path
| (`detectSectionFromPath`), so the server sends no section.
|
*/

test('a 404 renders the not-found page through the shared props', function (string $url, string $expectedPath) {
    $this->get($url)->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Errors/NotFound')
            ->where('status', 404)
            ->where('path', $expectedPath)
            // the page picks its variant from the path; the server keeps no copy
            ->missing('section')
            // the shared props a normal page gets, not a hand-built subset
            ->has('siteNavigation')
            ->has('sitePopup')
            ->has('auth')
        );
})->with([
    'general' => ['/some-non-existent-page', '/some-non-existent-page'],
    'muslim subdirectory' => ['/muslim/unknown-page', '/muslim/unknown-page'],
    'games subdirectory' => ['/games/chess', '/games/chess'],
    'transit subdirectory' => ['/transit/unknown-route', '/transit/unknown-route'],
    'mishwar subdirectory' => ['/mishwar/unknown-place', '/mishwar/unknown-place'],
    'crossings subdirectory' => ['/crossings/unknown-border', '/crossings/unknown-border'],
]);

test('the 404 page carries the same security headers as a normal page', function () {
    $response = $this->get('/some-non-existent-page')->assertNotFound();

    $csp = $response->headers->get('Content-Security-Policy-Report-Only');

    expect($csp)->toBeString()
        ->and($response->headers->get('Permissions-Policy'))->toBeString();

    expect(preg_match("/'nonce-([^']+)'/", $csp, $matches))->toBe(1);

    // The same nonce is stamped on the page's inline scripts.
    expect($response->getContent())->toContain('nonce="'.$matches[1].'"');
});
