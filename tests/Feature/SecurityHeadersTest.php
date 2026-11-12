<?php

/*
|--------------------------------------------------------------------------
| Report-only CSP + Permissions-Policy
|--------------------------------------------------------------------------
|
| The policy ships report-only on purpose: it is observable in violation
| reports before it is ever enforced. These tests pin that contract — the
| header exists, the nonce in it is the one stamped on the Blade inline
| scripts, and no enforcing header is sent.
|
*/

test('an html page sends a report-only csp carrying the page nonce', function () {
    $response = $this->get('/games')->assertOk();

    $csp = $response->headers->get('Content-Security-Policy-Report-Only');

    expect($csp)->toBeString()
        ->and($csp)->toContain('object-src \'none\'')
        ->and($csp)->toContain('base-uri \'none\'')
        ->and($csp)->toContain('frame-ancestors \'self\'')
        ->and($csp)->toContain('\'strict-dynamic\'')
        ->and($csp)->toContain('\'report-sample\'');

    expect(preg_match("/'nonce-([^']+)'/", $csp, $matches))->toBe(1);

    $nonce = $matches[1];

    expect($nonce)->not->toBeEmpty()
        // app.blade.php stamps the same value on its inline scripts.
        ->and($response->getContent())->toContain('nonce="'.$nonce.'"');

    // Report-only means nothing is blocked yet: there must be no enforcing header.
    expect($response->headers->has('Content-Security-Policy'))->toBeFalse();
});

test('every page load gets its own nonce', function () {
    $first = $this->get('/games')->headers->get('Content-Security-Policy-Report-Only');
    $second = $this->get('/games')->headers->get('Content-Security-Policy-Report-Only');

    preg_match("/'nonce-([^']+)'/", $first, $a);
    preg_match("/'nonce-([^']+)'/", $second, $b);

    expect($a[1])->not->toBe($b[1]);
});

test('html pages also send a permissions policy', function () {
    $response = $this->get('/games')->assertOk();

    expect($response->headers->get('Permissions-Policy'))
        ->toBeString()
        ->toContain('geolocation=(self)')
        ->toContain('camera=()');
});

test('the report-only policy can be switched off without a code deploy', function () {
    config(['security.csp_report_only' => false]);

    $response = $this->get('/games')->assertOk();

    expect($response->headers->has('Content-Security-Policy-Report-Only'))->toBeFalse()
        ->and($response->headers->has('Content-Security-Policy'))->toBeFalse();
});

test('a configured report uri is appended to the policy', function () {
    config(['security.csp_report_uri' => 'https://sentry.example/api/1/security/?sentry_key=abc']);

    $response = $this->get('/games')->assertOk();

    expect($response->headers->get('Content-Security-Policy-Report-Only'))
        ->toContain('report-uri https://sentry.example/api/1/security/?sentry_key=abc');
});

test('non-html responses are left untouched', function () {
    $response = $this->get('/healthcheck')->assertOk();

    expect($response->headers->get('Content-Type'))->toContain('text/plain')
        ->and($response->headers->has('Content-Security-Policy-Report-Only'))->toBeFalse()
        ->and($response->headers->has('Permissions-Policy'))->toBeFalse();
});

test('an error page rendered by the exception handler carries the same headers and nonce', function () {
    // 404s are rendered from bootstrap/app.php after the middleware stack has
    // unwound, so they exercise the handler-side path rather than handle().
    $response = $this->get('/this-page-does-not-exist')->assertNotFound();

    $csp = $response->headers->get('Content-Security-Policy-Report-Only');

    expect($csp)->toBeString()
        ->and($csp)->toContain('object-src \'none\'');

    expect(preg_match("/'nonce-([^']+)'/", $csp, $matches))->toBe(1);

    $nonce = $matches[1];

    expect($nonce)->not->toBeEmpty()
        // The nonce had to be registered before the error view was rendered.
        ->and($response->getContent())->toContain('nonce="'.$nonce.'"');

    expect($response->headers->get('Permissions-Policy'))
        ->toBeString()
        ->toContain('geolocation=(self)')
        ->toContain('camera=()');

    expect($response->headers->has('Content-Security-Policy'))->toBeFalse();
});
