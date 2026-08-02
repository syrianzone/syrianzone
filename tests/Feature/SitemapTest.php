<?php

use App\Models\Poll;

/**
 * Pull every <loc> out of a sitemap document as a plain array of strings.
 */
function sitemapLocs(string $body): array
{
    $xml = simplexml_load_string($body);

    $locs = [];
    foreach ($xml->url as $url) {
        $locs[] = (string) $url->loc;
    }

    return $locs;
}

test('sitemap is served as xml', function () {
    $this->get('/sitemap.xml')
        ->assertOk()
        ->assertHeader('Content-Type', 'application/xml; charset=UTF-8');
});

test('sitemap is well-formed with a urlset root', function () {
    $xml = simplexml_load_string($this->get('/sitemap.xml')->getContent());

    expect($xml)->not->toBeFalse()
        ->and($xml->getName())->toBe('urlset')
        ->and(count($xml->url))->toBeGreaterThan(20);
});

test('sitemap lists the public pages', function () {
    $locs = sitemapLocs($this->get('/sitemap.xml')->getContent());

    foreach (['/', '/tierlist', '/mishwar', '/transit', '/syofficial', '/about'] as $path) {
        expect($locs)->toContain('https://syrian.zone'.$path);
    }
});

test('every url uses the canonical host', function () {
    foreach (sitemapLocs($this->get('/sitemap.xml')->getContent()) as $loc) {
        expect($loc)->toStartWith('https://syrian.zone/');
    }
});

test('sitemap contains no duplicate urls', function () {
    $locs = sitemapLocs($this->get('/sitemap.xml')->getContent());

    expect($locs)->toHaveCount(count(array_unique($locs)));
});

test('sitemap omits gated, ephemeral and redirect urls', function () {
    $body = $this->get('/sitemap.xml')->getContent();

    // /places and /transit/city/{id}/map are 301 shims; the rest are gated or ephemeral.
    foreach (['/admin', '/dashboard', '/auth/', '/guesswho/room', '/healthcheck', '/dev/'] as $path) {
        expect($body)->not->toContain($path);
    }

    expect(sitemapLocs($body))->not->toContain('https://syrian.zone/places');
});

test('sitemap includes active polls and skips inactive ones', function () {
    Poll::factory()->create(['slug' => 'live-poll', 'is_active' => true]);
    Poll::factory()->create(['slug' => 'retired-poll', 'is_active' => false]);

    $locs = sitemapLocs($this->get('/sitemap.xml')->getContent());

    expect($locs)->toContain('https://syrian.zone/polls/live-poll')
        ->and($locs)->toContain('https://syrian.zone/polls/live-poll/leaderboard')
        ->and($locs)->not->toContain('https://syrian.zone/polls/retired-poll');
});

test('the tier list poll is not listed twice', function () {
    // /tierlist and /polls/best-ministers render the same poll from the same
    // records, so only the /tierlist pair belongs in the sitemap.
    Poll::factory()->create(['slug' => 'best-ministers', 'is_active' => true]);

    $locs = sitemapLocs($this->get('/sitemap.xml')->getContent());

    expect($locs)->toContain('https://syrian.zone/tierlist')
        ->and($locs)->toContain('https://syrian.zone/tierlist/leaderboard')
        ->and($locs)->not->toContain('https://syrian.zone/polls/best-ministers')
        ->and($locs)->not->toContain('https://syrian.zone/polls/best-ministers/leaderboard');
});
