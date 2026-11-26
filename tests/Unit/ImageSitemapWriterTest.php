<?php

use App\Services\Sitemap\ImageSitemapUrl;
use App\Services\Sitemap\ImageSitemapWriter;

test('image sitemap writer emits google image namespace and escapes xml', function () {
    $writer = new ImageSitemapWriter('https://syrian.zone');

    $xml = $writer->render([
        new ImageSitemapUrl('/govapps/a&b', [
            '/assets/apps/icon&1.png',
            "https://cdn.example.com/screen.webp?a=1&b='two'",
        ]),
    ]);

    $parsed = simplexml_load_string($xml);

    expect($parsed)->not->toBeFalse()
        ->and($parsed->getName())->toBe('urlset')
        ->and($xml)->toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')
        ->and($xml)->toContain('<loc>https://syrian.zone/govapps/a%26b</loc>')
        ->and($xml)->toContain('<image:loc>https://syrian.zone/assets/apps/icon%261.png</image:loc>')
        ->and($xml)->toContain('<image:loc>https://cdn.example.com/screen.webp?a=1&amp;b=&apos;two&apos;</image:loc>');
});

test('image sitemap writer skips empty entries and caps each url at 1000 images', function () {
    $writer = new ImageSitemapWriter('https://syrian.zone');

    $images = [];
    for ($i = 1; $i <= 1050; $i++) {
        $images[] = "/images/item-{$i}.webp";
    }

    $xml = $writer->render([
        new ImageSitemapUrl('/empty', []),
        new ImageSitemapUrl('/full', $images),
    ]);

    $parsed = simplexml_load_string($xml);
    expect($parsed)->not->toBeFalse()
        ->and(count($parsed->url))->toBe(1);

    $nsImage = 'http://www.google.com/schemas/sitemap-image/1.1';
    expect(count($parsed->url[0]->children($nsImage)->image))->toBe(1000);
});
