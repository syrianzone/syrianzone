<?php

/*
|--------------------------------------------------------------------------
| Analytics consent
|--------------------------------------------------------------------------
|
| The measurement id is runtime config and is exposed as window.GA_ID. The
| gtag.js <script> tag was removed from the document on purpose: the consent
| module (resources/js/Lib/analyticsConsent.ts) is the only thing allowed to
| fetch it, and only after the visitor agrees. These tests pin that contract
| in the rendered HTML, which is what a visitor without JavaScript gets too.
|
*/

test('a configured measurement id is exposed without loading google analytics', function () {
    config(['services.google_analytics.id' => 'G-TEST123']);

    $response = $this->get('/games')->assertOk();

    expect($response->getContent())
        ->toContain('window.GA_ID = "G-TEST123"')
        // Nothing Google-hosted may be requested before consent is recorded.
        ->not->toContain('googletagmanager.com')
        ->not->toContain('google-analytics.com');
});

test('the id script keeps the page nonce', function () {
    config(['services.google_analytics.id' => 'G-TEST123']);

    $response = $this->get('/games')->assertOk();

    preg_match("/'nonce-([^']+)'/", $response->headers->get('Content-Security-Policy-Report-Only'), $matches);

    expect($matches[1])->not->toBeEmpty()
        ->and($response->getContent())->toContain('nonce="'.$matches[1].'"');
});

test('no measurement id means no analytics hooks at all', function () {
    config(['services.google_analytics.id' => null]);

    $response = $this->get('/games')->assertOk();

    expect($response->getContent())
        ->not->toContain('window.GA_ID')
        ->not->toContain('googletagmanager.com')
        ->not->toContain('google-analytics.com');
});
