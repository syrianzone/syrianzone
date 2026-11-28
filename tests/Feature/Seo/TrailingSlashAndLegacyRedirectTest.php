<?php

use App\Http\Controllers\LegacyRedirectController;
use App\Models\Poll;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Http\Request;
use Illuminate\Testing\TestResponse;

/**
 * Laravel's `$this->get()` normalizes URIs with `trim(url($uri), '/')`, which
 * strips trailing slashes before the request reaches the HTTP kernel. Dispatch
 * raw request URIs directly through the kernel so the middleware sees the real
 * incoming path and query string.
 */
function dispatchRawRequest(string $rawUri, string $method = 'GET'): TestResponse
{
    $kernel = app(HttpKernel::class);
    $request = Request::create('http://localhost'.$rawUri, $method);
    $response = $kernel->handle($request);
    $kernel->terminate($request, $response);

    return TestResponse::fromBaseResponse($response);
}

test('trailing-slash GET and HEAD requests redirect 301 to the slash-less path', function (string $from, string $expectedLocation) {
    $get = dispatchRawRequest($from, 'GET');
    $get->assertMovedPermanently();
    expect($get->headers->get('Location'))->toBe($expectedLocation);

    $head = dispatchRawRequest($from, 'HEAD');
    $head->assertMovedPermanently();
    expect($head->headers->get('Location'))->toBe($expectedLocation);
})->with([
    'syid' => ['/syid/', '/syid'],
    'syofficial' => ['/syofficial/', '/syofficial'],
    'tierlist' => ['/tierlist/', '/tierlist'],
    'compass' => ['/compass/', '/compass'],
    'sites' => ['/sites/', '/sites'],
    'query string preserved' => ['/syofficial/?fbclid=abc', '/syofficial?fbclid=abc'],
    'multiple query params order preserved' => ['/syid/?z=1&a=2&fbclid=xyz', '/syid?z=1&a=2&fbclid=xyz'],
    'repeated trailing slashes' => ['/syid//', '/syid'],
    'triple trailing slashes with query' => ['/syofficial///?tab=ministries', '/syofficial?tab=ministries'],
]);

test('root path is not redirected', function () {
    dispatchRawRequest('/', 'GET')->assertOk();
    dispatchRawRequest('/', 'HEAD')->assertOk();
});

test('mutating HTTP methods with trailing slashes are never redirected by the middleware', function (string $method) {
    $response = dispatchRawRequest('/api/submit/', $method);

    expect($response->getStatusCode())->not->toBe(301);
})->with(['POST', 'PUT', 'PATCH', 'DELETE']);

test('protocol-relative double-slash paths never produce an open redirect', function (string $rawUri, string $expectedLocation) {
    $response = dispatchRawRequest($rawUri, 'GET');

    $response->assertMovedPermanently();
    $location = (string) $response->headers->get('Location');

    expect($location)->toBe($expectedLocation)
        ->and(str_starts_with($location, '//'))->toBeFalse();
})->with([
    'double leading slash' => ['//evil.com/', '/evil.com'],
    'double leading slash with query' => ['//evil.com/?next=https://evil.com', '/evil.com?next=https://evil.com'],
    'triple leading slash' => ['///evil.com//', '/evil.com'],
    'double slash root' => ['//', '/'],
]);

test('static asset directories under public without a route are not redirected', function () {
    $response = dispatchRawRequest('/syid-assets/', 'GET');

    expect($response->getStatusCode())->not->toBe(301);

    $nested = dispatchRawRequest('/syid-assets/materials/', 'GET');
    expect($nested->getStatusCode())->not->toBe(301);
});

test('legacy syid material URLs redirect 301 to existing files under syid-assets', function () {
    foreach (LegacyRedirectController::syidMaterialTargets() as $legacyFile => $expectedTarget) {
        $encoded = implode('/', array_map('rawurlencode', explode('/', $legacyFile)));
        $response = $this->get("/syid/materials/{$encoded}");

        $response->assertMovedPermanently()
            ->assertRedirect($expectedTarget);

        expect(public_path(ltrim($expectedTarget, '/')))->toBeFile();
    }
});

test('explicitly required syid material legacy mappings resolve as expected', function () {
    $this->get('/syid/materials/logo.ai.svg')
        ->assertMovedPermanently()
        ->assertRedirect('/syid-assets/materials/logo.ai.svg');

    $this->get('/syid/materials/'.rawurlencode('العلم السوري بالنسب الصحيحة.png'))
        ->assertMovedPermanently()
        ->assertRedirect('/syid-assets/materials/syrian-flag-proportions.png');
});

test('unknown or removed syid material paths redirect 301 to /syid', function (string $path) {
    $this->get($path)
        ->assertMovedPermanently()
        ->assertRedirect('/syid');
})->with([
    'bare materials folder' => ['/syid/materials'],
    'unknown file' => ['/syid/materials/does-not-exist.png'],
    'removed nested abdalhade file' => ['/syid/materials/abdalhade/IMG_9403.jpg'],
    'removed nested scrollexx file' => ['/syid/materials/scrollexx/scrollexx-wallpaper.png'],
]);

test('legacy syofficial governorate webp URLs redirect 301 to existing governorate icon files', function () {
    foreach (LegacyRedirectController::governorateIconTargets() as $slug => $expectedTarget) {
        $prefixed = str_starts_with($slug, 'gov-') ? $slug : "gov-{$slug}";

        $this->get("/syofficial/images/governorates/{$prefixed}.webp")
            ->assertMovedPermanently()
            ->assertRedirect($expectedTarget);

        expect(public_path(ltrim($expectedTarget, '/')))->toBeFile();
    }
});

test('unknown syofficial governorate image redirects 301 to /syofficial', function (string $file) {
    $this->get("/syofficial/images/governorates/{$file}.webp")
        ->assertMovedPermanently()
        ->assertRedirect('/syofficial');
})->with(['placeholder', 'unknown-governorate']);

test('legacy syofficial image paths outside governorates redirect 301 to /syofficial while governorate icons keep exact targets', function (string $path) {
    $this->get($path)
        ->assertMovedPermanently()
        ->assertRedirect('/syofficial');

    $this->get('/syofficial/images/governorates/gov-lattakia.webp')
        ->assertMovedPermanently()
        ->assertRedirect('/syid-assets/icons/governorates/with-frame/latakia-triumph-arch.svg');
})->with([
    'embassy webp' => ['/syofficial/images/embassies/emb-ecsc.webp'],
    'ministry webp' => ['/syofficial/images/ministries/min-interior.webp'],
]);

test('legacy page routes redirect 301 to live 200 targets', function (string $from, string $target) {
    if ($target === '/tierlist/leaderboard') {
        Poll::factory()->create(['slug' => 'best-ministers', 'is_active' => true]);
    }

    $this->get($from)
        ->assertMovedPermanently()
        ->assertRedirect($target);

    $this->get($target)->assertOk();
})->with([
    'leaderboard' => ['/leaderboard', '/tierlist/leaderboard'],
    'bingo' => ['/bingo', '/games'],
    'solitaire spelling' => ['/games/solitaire', '/games/solitare'],
    'syid fallback' => ['/syid/materials/nonexistent.png', '/syid'],
    'syofficial fallback' => ['/syofficial/images/governorates/unknown.webp', '/syofficial'],
    'syofficial embassy fallback' => ['/syofficial/images/embassies/emb-ecsc.webp', '/syofficial'],
]);

test('static flag-replacer privacy policy is marked noindex without a conflicting canonical and remains crawlable', function () {
    $html = file_get_contents(public_path('flag-replacer/privacy-policy.html'));
    $robots = file_get_contents(public_path('robots.txt'));

    expect($html)->toBeString()
        ->and($html)->toContain('<meta name="robots" content="noindex, nofollow"')
        ->and($html)->not->toContain('rel="canonical"')
        ->and($robots)->toBeString()
        ->and($robots)->not->toContain('Disallow: /flag-replacer');
});
