<?php

use App\Support\Facts;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    Cache::flush();

    // Ensure the bootstrap route file is loaded even before routes/api.php requires it.
    if (! Route::has('api.v1.bootstrap.show')) {
        Route::prefix('api')->middleware('api')->group(base_path('routes/api-bootstrap.php'));
        app('router')->getRoutes()->refreshNameLookups();
        app('router')->getRoutes()->refreshActionLookups();
    }
});

test('exported module icons exist as valid standalone light and dark SVGs without Tailwind or CSS vars', function () {
    $dir = public_path('assets/icons/modules');
    $manifestPath = $dir.'/manifest.json';

    expect(is_file($manifestPath))->toBeTrue('manifest.json must exist; run `bun run icons:export`');

    $manifest = json_decode((string) file_get_contents($manifestPath), true);
    expect($manifest)->toBeArray()
        ->and($manifest['version'] ?? null)->toBeString()->not->toBeEmpty()
        ->and($manifest['icons'] ?? null)->toBeArray()->not->toBeEmpty();

    $rawIcons = Facts::projectIcons()['icons'];
    foreach ($rawIcons as $key => $entry) {
        if (isset($entry['alias'])) {
            expect($manifest['aliases'][$key] ?? null)->toBe($entry['alias']);

            continue;
        }

        expect($manifest['icons'])->toHaveKey($key);

        foreach (["{$key}.svg", "{$key}-dark.svg"] as $filename) {
            $path = $dir.'/'.$filename;
            expect(is_file($path))->toBeTrue("Missing exported SVG: {$filename}");

            $svg = (string) file_get_contents($path);
            expect($svg)->toContain('<svg')
                ->and($svg)->toContain('</svg>')
                ->and($svg)->not->toContain('class=')
                ->and($svg)->not->toContain('var(--');

            // Verify valid XML
            $previous = libxml_use_internal_errors(true);
            $parsed = simplexml_load_string($svg);
            $errors = libxml_get_errors();
            libxml_clear_errors();
            libxml_use_internal_errors($previous);

            expect($parsed)->not->toBeFalse("Invalid XML in {$filename}: ".implode('; ', array_map(fn ($e) => trim($e->message), $errors)));
        }
    }
});

test('GET /api/v1/navigation populates absolute iconUrl and iconUrlDark for every item and subCategory', function () {
    $response = $this->getJson('/api/v1/navigation')->assertOk();
    $items = collect($response->json('items'));

    expect($items)->not->toBeEmpty();

    foreach ($items as $item) {
        expect($item['iconUrl'])->toBeString()
            ->and($item['iconUrl'])->toMatch('/^https?:\/\//', "Item {$item['id']} iconUrl must be absolute");

        if ($item['iconUrlDark'] !== null) {
            expect($item['iconUrlDark'])->toMatch('/^https?:\/\//', "Item {$item['id']} iconUrlDark must be absolute");
        }

        foreach ($item['subCategories'] ?? [] as $sub) {
            expect($sub['iconUrl'])->toBeString()
                ->and($sub['iconUrl'])->toMatch('/^https?:\/\//', "SubCategory {$sub['id']} iconUrl must be absolute")
                ->and($sub['iconUrlDark'])->toBeString()
                ->and($sub['iconUrlDark'])->toMatch('/^https?:\/\//', "SubCategory {$sub['id']} iconUrlDark must be absolute");
        }
    }

    // Alias resolution: atlas -> population
    $atlas = $items->firstWhere('id', 'atlas');
    expect($atlas)->not->toBeNull()
        ->and($atlas['iconUrl'])->toContain('/assets/icons/modules/population.svg?v=')
        ->and($atlas['iconUrlDark'])->toContain('/assets/icons/modules/population-dark.svg?v=');

    // Relative custom icons normalized to absolute URLs
    $president = $items->firstWhere('id', 'president');
    expect($president)->not->toBeNull()
        ->and($president['iconUrl'])->toMatch('/^https?:\/\/.+\/assets\/games\/president\.svg$/');

    $flagReplacer = $items->firstWhere('id', 'flag_replacer');
    expect($flagReplacer)->not->toBeNull()
        ->and($flagReplacer['iconUrl'])->toMatch('/^https?:\/\/.+\/flag-replacer\/1f1f8-1f1fe\.svg$/');

    // External URLs preserved intact
    $jard = $items->firstWhere('id', 'jard');
    expect($jard)->not->toBeNull()
        ->and($jard['iconUrl'])->toBe('https://jard.chat/images/logo-light.svg')
        ->and($jard['iconUrlDark'])->toBe('https://jard.chat/images/logo-dark.svg');
});

test('GET /api/v1/bootstrap returns the complete mobile bootstrap payload and supports ETag / 304', function () {
    $first = $this->getJson('/api/v1/bootstrap')->assertOk();

    $etag = $first->headers->get('ETag');
    $cacheControl = $first->headers->get('Cache-Control');

    expect($etag)->toBeString()->not->toBeEmpty()
        ->and($cacheControl)->toContain('max-age=300')
        ->and($cacheControl)->toContain('stale-while-revalidate=3600')
        ->and($first->json('apiVersion'))->toBe('1')
        ->and($first->json('navigation.items'))->toBeArray()->not->toBeEmpty()
        ->and($first->json('popup'))->toBeArray()->toHaveKeys(['enabled', 'title', 'version'])
        ->and($first->json('themes.defaults'))->toBe(['light' => 'nili', 'dark' => 'nili-night'])
        ->and($first->json('themes.items'))->toBeArray()->not->toBeEmpty()
        ->and($first->json('themes.items.0'))->toHaveKeys(['id', 'nameAr', 'isDark', 'bg', 'primary'])
        ->and($first->json('reference.governorates'))->toBeArray()->toHaveCount(14)
        ->and($first->json('reference.prayerMethods'))->toBeArray()->toHaveKeys(['default_method', 'methods'])
        ->and($first->json('reference.mediaBaseUrl'))->toBeString()->toMatch('/^https?:\/\//')
        ->and($first->json('datasetVersions'))->toHaveKeys([
            'phonebook',
            'syofficial',
            'govapps',
            'wildlife',
            'promises',
            'govtcvs',
            'crossings',
            'ministries',
        ]);

    // Every navigation item in bootstrap also has an absolute iconUrl
    foreach ($first->json('navigation.items') as $item) {
        expect($item['iconUrl'])->toMatch('/^https?:\/\//');
    }

    // Conditional request with matching ETag returns 304 Not Modified
    $second = $this->withHeaders(['If-None-Match' => $etag])
        ->getJson('/api/v1/bootstrap');

    $second->assertStatus(304);
    expect($second->headers->get('ETag'))->toBe($etag);
});
