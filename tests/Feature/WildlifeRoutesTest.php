<?php

use App\Services\Wildlife\WildlifeData;
use App\Support\Facts;
use Inertia\Testing\AssertableInertia as Assert;

test('the wildlife guide is public and gets a card per species, not the full records', function () {
    $count = count(Facts::json('wildlife')['species']);

    $this->get('/wild')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Wild/Index')
            ->has('species', $count)
            ->where('stats.total', $count)
            ->has('sources')
            ->missing('species.0.factsAr')
            ->missing('species.0.sources'));
});

test('a species page gets its own record and three other species', function () {
    $this->get('/wild/golden-hamster')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Wild/Show')
            ->where('species.slug', 'golden-hamster')
            ->has('species.factsAr')
            ->has('related', 3)
            ->missing('related.0.factsAr'));
});

test('related species follow the page in its group, so every species is linked from another page', function () {
    $data = app(WildlifeData::class);
    $linked = [];
    foreach ($data->all() as $species) {
        foreach ($data->forSpecies($species['slug'])['related'] as $other) {
            expect($other['slug'])->not->toBe($species['slug']);
            $linked[$other['slug']] = true;
        }
    }

    expect(array_keys($linked))->toEqualCanonicalizing(array_column($data->all(), 'slug'));
});

test('a governorate page lists the species recorded there', function () {
    $listed = app(WildlifeData::class)->forGovernorate('homs');

    expect(array_column($listed, 'slug'))->toContain('northern-bald-ibis');
    expect(collect($listed)->firstWhere('slug', 'northern-bald-ibis')['historical'])->toBeTrue();
});

test('species titles lead with the Arabic name and descriptions fit a search snippet', function () {
    $html = $this->get('/wild/pallid-harrier')->assertOk()->getContent();

    expect($html)->toContain('>المرزة الباهتة في سوريا | الحياة البرية</title>');
    preg_match('/<meta name="description" content="([^"]*)"/u', $html, $m);
    expect(mb_strlen(html_entity_decode($m[1])))->toBeLessThanOrEqual(160)->toBeGreaterThan(100);
});

test('the hub lists every species as structured data', function () {
    $html = $this->get('/wild')->assertOk()->getContent();

    expect($html)->toContain('"@type":"ItemList"')
        ->toContain('https://syrian.zone/wild/northern-bald-ibis');
});

test('an unknown species is a 404', function () {
    $this->get('/wild/not-a-species')->assertNotFound();
});

test('a species page carries its own title, canonical and share card', function () {
    $html = $this->get('/wild/striped-hyena')->assertOk()->getContent();

    expect($html)
        ->toContain('الضبع المخطّط')
        ->toContain('<link rel="canonical" href="https://syrian.zone/wild/striped-hyena"')
        ->toContain('/og/r/wild/striped-hyena.png');
});

test('the guide and each species are listed in the sitemap', function () {
    $this->get('/sitemap.xml')
        ->assertOk()
        ->assertSee('https://syrian.zone/wild', escape: false)
        ->assertSee('https://syrian.zone/wild/northern-bald-ibis', escape: false);
});
