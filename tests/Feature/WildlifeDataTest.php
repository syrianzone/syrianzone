<?php

use App\Models\WildlifeSpecies;
use App\Services\Wildlife\WildlifeData;
use App\Services\Wildlife\WildlifeImporter;
use App\Services\Wildlife\WildlifeRules;
use App\Support\Facts;

/**
 * Holds the wildlife guide to the sourcing rules in docs/modules/wildlife.md.
 * The rules themselves live in WildlifeRules, which the editor also applies
 * to every draft and every publish; these tests run them on the seed file and
 * pin down what each rule refuses.
 */
function seedSpecies(): array
{
    return Facts::json('wildlife')['species'] ?? [];
}

/** A valid record to break one rule at a time. */
function validWildlifeRecord(): array
{
    return collect(seedSpecies())->firstWhere('slug', 'golden-hamster');
}

test('the seed file has species and every one passes the sourcing rules', function () {
    $rules = app(WildlifeRules::class);

    expect(seedSpecies())->not->toBeEmpty();
    foreach (seedSpecies() as $record) {
        expect($rules->errors($record))->toBe([], $record['slug'] ?? '?');
    }
});

test('slugs in the seed file are unique', function () {
    $slugs = array_column(seedSpecies(), 'slug');

    expect(array_unique($slugs))->toHaveCount(count($slugs));
});

test('the migration imports the seed file as published species, in order', function () {
    expect(WildlifeSpecies::query()->orderBy('position')->pluck('slug')->all())
        ->toBe(array_column(seedSpecies(), 'slug'));
    expect(app(WildlifeData::class)->all())->toBe(array_values(seedSpecies()));
});

test('exporting the published species reproduces the seed file byte for byte', function () {
    expect(app(WildlifeImporter::class)->exportJson())
        ->toBe(file_get_contents(resource_path('data/wildlife.json')));
});

test('the rules refuse an uncited statement and a citation to a source that does not exist', function () {
    $record = validWildlifeRecord();
    $record['factsAr'][0]['sources'] = [];
    $record['threatsAr'][0]['sources'] = [99];

    $errors = implode("\n", app(WildlifeRules::class)->errors($record));

    expect($errors)->toContain('factsAr[0]: every statement must cite')
        ->toContain('threatsAr[0]: source index 99 does not exist');
});

test('the rules refuse fewer than two sources and a non-https source', function () {
    $record = validWildlifeRecord();
    $record['sources'] = [['title' => 'A blog', 'url' => 'http://example.com']];
    $record['summarySources'] = [0];
    $record['factsAr'] = [['text' => 'نص', 'sources' => [0]]];
    $record['threatsAr'] = [];

    $errors = implode("\n", app(WildlifeRules::class)->errors($record));

    expect($errors)->toContain('at least two sources')->toContain('sources[0] needs');
});

test('the rules refuse unknown vocabulary, governorates and IUCN links', function () {
    $record = validWildlifeRecord();
    $record['group'] = 'dragon';
    $record['syriaStatus'] = 'common';
    $record['habitats'] = ['desert'];
    $record['governorates'] = ['atlantis'];
    $record['iucn'] = ['category' => 'XX', 'url' => 'https://www.iucnredlist.org/species/123'];

    $errors = implode("\n", app(WildlifeRules::class)->errors($record));

    expect($errors)->toContain('group must be one of')
        ->toContain('syriaStatus must be one of')
        ->toContain('habitats may only hold')
        ->toContain('"atlantis" is not a governorate id')
        ->toContain('iucn.category must be one of')
        ->toContain('iucn.url must link the exact assessment');
});

test('the rules refuse a non-free photo license and a missing credit', function () {
    $record = validWildlifeRecord();
    $record['image']['license'] = 'CC BY-NC 4.0';
    $record['image']['author'] = '';

    $errors = implode("\n", app(WildlifeRules::class)->errors($record));

    expect($errors)->toContain('image.license must be')->toContain('image.author is required');
});

test('the rules refuse a review date that is malformed or in the future', function () {
    $record = validWildlifeRecord();

    $record['lastReviewed'] = '2026-13-01';
    expect(implode(' ', app(WildlifeRules::class)->errors($record)))->toContain('YYYY-MM-DD');

    $record['lastReviewed'] = now()->addYear()->toDateString();
    expect(implode(' ', app(WildlifeRules::class)->errors($record)))->toContain('cannot be in the future');
});
