<?php

use App\Services\Sitemap\SitemapUrl;
use App\Services\Sitemap\SitemapWriter;
use Illuminate\Support\Carbon;

test('renders a urlset in the sitemaps.org namespace', function () {
    $xml = (new SitemapWriter())->render([new SitemapUrl('/about', 0.5, 'monthly')]);

    $parsed = simplexml_load_string($xml);

    expect($parsed)->not->toBeFalse()
        ->and($parsed->getName())->toBe('urlset')
        ->and($xml)->toContain('http://www.sitemaps.org/schemas/sitemap/0.9');
});

test('prefixes paths with the base url', function () {
    $xml = (new SitemapWriter('https://example.test'))->render([
        new SitemapUrl('/about', 0.5, 'monthly'),
    ]);

    expect($xml)->toContain('<loc>https://example.test/about</loc>');
});

test('omits lastmod when it is unknown', function () {
    $xml = (new SitemapWriter())->render([new SitemapUrl('/about', 0.5, 'monthly')]);

    expect($xml)->not->toContain('<lastmod>');
});

test('writes lastmod as a w3c datetime', function () {
    $xml = (new SitemapWriter())->render([
        new SitemapUrl('/about', 0.5, 'monthly', Carbon::parse('2026-03-04 05:06:07', 'UTC')),
    ]);

    expect($xml)->toContain('<lastmod>2026-03-04T05:06:07+00:00</lastmod>');
});

test('percent-encodes path segments without escaping the separators', function () {
    $xml = (new SitemapWriter('https://example.test'))->render([
        new SitemapUrl('/polls/a b/leaderboard', 0.5, 'daily'),
    ]);

    expect($xml)->toContain('<loc>https://example.test/polls/a%20b/leaderboard</loc>');
});

test('renders the root path as a bare slash', function () {
    $xml = (new SitemapWriter('https://example.test'))->render([
        new SitemapUrl('/', 1.0, 'daily'),
    ]);

    expect($xml)->toContain('<loc>https://example.test/</loc>');
});

test('formats priority to one decimal place', function () {
    $xml = (new SitemapWriter())->render([new SitemapUrl('/', 1.0, 'daily')]);

    expect($xml)->toContain('<priority>1.0</priority>');
});

test('renders an empty urlset when there is nothing to list', function () {
    $xml = (new SitemapWriter())->render([]);

    expect(simplexml_load_string($xml))->not->toBeFalse()
        ->and($xml)->toContain('<urlset');
});
