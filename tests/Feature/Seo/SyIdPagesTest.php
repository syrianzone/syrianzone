<?php

use App\Support\Facts;

/**
 * Extract and decode the JSON-LD `@graph` from an HTML page response.
 *
 * @return list<array<string, mixed>>
 */
function syidJsonLdGraph(string $html): array
{
    preg_match('#<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>#s', $html, $matches);
    expect($matches)->toHaveCount(2, 'Expected a JSON-LD <script> block in the page head.');

    $decoded = json_decode($matches[1], true, flags: JSON_THROW_ON_ERROR);
    expect($decoded)->toHaveKey('@graph');

    return $decoded['@graph'];
}

test('syid hub, logo, and flag pages return 200 with expected Inertia components and titles', function () {
    $this->get('/syid')
        ->assertOk()
        ->assertSee('<title inertia>الهوية البصرية السورية | Syrian Zone</title>', false)
        ->assertInertia(fn ($page) => $page
            ->component('SyId/Index')
            ->has('syid.palettes')
            ->has('syid.logo')
            ->has('syid.flag'));

    $this->get('/syid/logo')
        ->assertOk()
        ->assertSee('<title inertia>شعار الجمهورية العربية السورية الجديد — تحميل SVG وPNG وPDF بدقة 4K | Syrian Zone</title>', false)
        ->assertInertia(fn ($page) => $page
            ->component('SyId/Logo')
            ->has('syid.logo.variants', 3));

    $this->get('/syid/flag')
        ->assertOk()
        ->assertSee('<title inertia>علم سوريا الجديد — الصور، النسب، الألوان، والتحميل | Syrian Zone</title>', false)
        ->assertInertia(fn ($page) => $page
            ->component('SyId/Flag')
            ->has('syid.flag.downloads', 5));
});

test('/syid/logo emits valid ImageObject and BreadcrumbList JSON-LD without invented license', function () {
    $html = $this->get('/syid/logo')->assertOk()->getContent();
    $graph = syidJsonLdGraph($html);

    $image = collect($graph)->firstWhere('@type', 'ImageObject');
    expect($image)->not->toBeNull()
        ->and($image['contentUrl'])->toEndWith('/syid-assets/downloads/syrian-arab-republic-eagle-emblem-4k.png')
        ->and($image['name'])->not->toBeEmpty()
        ->and($image['caption'])->not->toBeEmpty()
        ->and($image['creditText'])->not->toBeEmpty()
        ->and($image['width'])->toBe(3840)
        ->and($image['height'])->toBe(3840)
        ->and($image)->not->toHaveKey('license')
        ->and($image)->not->toHaveKey('copyrightNotice');

    $breadcrumb = collect($graph)->firstWhere('@type', 'BreadcrumbList');
    expect($breadcrumb)->not->toBeNull()
        ->and(array_column($breadcrumb['itemListElement'], 'name'))
        ->toBe(['الرئيسية', 'الهوية البصرية السورية', 'الشعار']);
});

test('/syid/flag emits valid ImageObject, FAQPage, and BreadcrumbList JSON-LD', function () {
    $html = $this->get('/syid/flag')->assertOk()->getContent();
    $graph = syidJsonLdGraph($html);

    $image = collect($graph)->firstWhere('@type', 'ImageObject');
    expect($image)->not->toBeNull()
        ->and($image['contentUrl'])->toEndWith('/syid-assets/downloads/syrian-flag-3840.png')
        ->and($image['width'])->toBe(3840)
        ->and($image['height'])->toBe(2560)
        ->and($image['name'])->not->toBeEmpty()
        ->and($image['caption'])->not->toBeEmpty()
        ->and($image['creditText'])->not->toBeEmpty();

    $faq = collect($graph)->firstWhere('@type', 'FAQPage');
    expect($faq)->not->toBeNull()
        ->and($faq['mainEntity'])->not->toBeEmpty()
        ->and($faq['mainEntity'][0]['@type'])->toBe('Question')
        ->and($faq['mainEntity'][0]['acceptedAnswer']['@type'])->toBe('Answer');

    $breadcrumb = collect($graph)->firstWhere('@type', 'BreadcrumbList');
    expect($breadcrumb)->not->toBeNull()
        ->and(array_column($breadcrumb['itemListElement'], 'name'))
        ->toBe(['الرئيسية', 'الهوية البصرية السورية', 'العلم السوري']);
});

test('every syid download and preview asset in Facts::syid() exists on disk with matching byte size', function () {
    $facts = Facts::syid();
    $filesToCheck = [];

    $filesToCheck[] = ['path' => $facts['logo']['hero_image']['path']];
    $filesToCheck[] = ['path' => $facts['logo']['hero_image']['full_path'], 'max_bytes' => 2_000_000];
    foreach ($facts['logo']['variants'] as $variant) {
        $filesToCheck[] = ['path' => $variant['preview_path']];
        foreach ($variant['downloads'] as $dl) {
            $filesToCheck[] = ['path' => $dl['path'], 'size_bytes' => $dl['size_bytes'], 'max_bytes' => 2_000_000];
        }
    }

    $filesToCheck[] = ['path' => $facts['flag']['hero_image']['path']];
    $filesToCheck[] = ['path' => $facts['flag']['hero_image']['full_path'], 'max_bytes' => 2_000_000];
    foreach ($facts['flag']['downloads'] as $dl) {
        $filesToCheck[] = ['path' => $dl['path'], 'size_bytes' => $dl['size_bytes'], 'max_bytes' => 2_000_000];
    }
    foreach ($facts['flag']['proportion_downloads'] as $dl) {
        $filesToCheck[] = ['path' => $dl['path'], 'size_bytes' => $dl['size_bytes']];
    }
    foreach ($facts['flag']['wallpapers'] as $wp) {
        $filesToCheck[] = ['path' => $wp['preview_path']];
        foreach ($wp['downloads'] as $dl) {
            $filesToCheck[] = ['path' => $dl['path'], 'size_bytes' => $dl['size_bytes']];
        }
    }
    $filesToCheck[] = ['path' => $facts['flag']['guide']['preview_path']];

    expect($filesToCheck)->not->toBeEmpty();

    foreach ($filesToCheck as $entry) {
        $diskPath = public_path(ltrim((string) $entry['path'], '/'));
        expect(is_file($diskPath), "Missing asset on disk: {$entry['path']}")->toBeTrue();

        $actualSize = filesize($diskPath);
        if (isset($entry['size_bytes'])) {
            expect($actualSize, "Byte size mismatch for {$entry['path']}")->toBe($entry['size_bytes']);
        }
        if (isset($entry['max_bytes'])) {
            expect($actualSize, "Asset exceeds max size: {$entry['path']}")->toBeLessThan($entry['max_bytes']);
        }
    }
});
