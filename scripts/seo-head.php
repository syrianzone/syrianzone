<?php

/**
 * Dumps what the server prints into <head> for every public GET page route:
 * path => [title, description, canonical, og:image, json-ld].
 *
 *   php scripts/seo-head.php > /tmp/seo.json
 *
 * Used to diff the head before and after a change to the SEO registry, and by
 * `tests/Feature/Seo/HeadContractTest.php` to prove the single page table still
 * answers every route. Run it with the same environment the tests use.
 */

use App\Support\Seo\SeoMeta;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Routing\RedirectController;
use Illuminate\Support\Facades\Route;

$root = dirname(__DIR__);

require $root.'/vendor/autoload.php';
$app = require $root.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$head = [];

foreach (Route::getRoutes() as $route) {
    $uri = $route->uri();

    if (! in_array('GET', $route->methods(), true)
        || str_contains($uri, '{')
        || ! in_array('web', $route->gatherMiddleware(), true)
        || str_starts_with($uri, 'api/')
        || ltrim((string) $route->getControllerClass(), '\\') === RedirectController::class
    ) {
        continue;
    }

    $path = '/'.ltrim($uri, '/');
    $meta = SeoMeta::resolve(Request::create($path, 'GET'));

    $head[$path] = [
        'title' => $meta['title'],
        'description' => $meta['description'],
        'canonical' => $meta['canonical'],
        'og_title' => $meta['og_title'],
        'og_image' => $meta['image'],
        'robots' => $meta['robots'],
        'json_ld' => $meta['json_ld'],
    ];
}

ksort($head);

echo json_encode($head, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), "\n";
