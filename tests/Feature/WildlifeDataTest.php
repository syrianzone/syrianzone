<?php

use App\Support\Facts;
use App\Support\Seo\Preview\Resolvers\WildSpeciesPreview;

/**
 * Holds resources/data/wildlife.json to the sourcing rules in
 * docs/modules/wildlife.md: every statement points at a source the species
 * lists, every vocabulary value is a known one, and every photo is freely
 * licensed and credited.
 */
function wildlifeSpecies(): array
{
    return Facts::json('wildlife')['species'] ?? [];
}

const WILDLIFE_GROUPS = ['mammal', 'bird', 'reptile', 'amphibian', 'fish', 'invertebrate'];
const WILDLIFE_HABITATS = ['steppe', 'mountains', 'farmland', 'wetlands', 'coast'];
/** CC0, public domain, and CC BY / BY-SA in any version or national port ("CC BY-SA 3.0 de"). */
const WILDLIFE_LICENSE = '/^(CC0 1\.0|Public domain|CC BY(-SA)? \d\.\d( [a-z]{2})?)$/';

test('the guide has species and their slugs are unique and url-safe', function () {
    $slugs = array_column(wildlifeSpecies(), 'slug');

    expect($slugs)->not->toBeEmpty();
    expect(array_unique($slugs))->toHaveCount(count($slugs));
    foreach ($slugs as $slug) {
        expect($slug)->toMatch('/^[a-z0-9-]+$/');
    }
});

test('every species uses only the known groups, categories, statuses and habitats', function () {
    $categories = array_keys(WildSpeciesPreview::iucnLabels());
    $statuses = array_keys(WildSpeciesPreview::statusLabels());

    foreach (wildlifeSpecies() as $s) {
        expect(WILDLIFE_GROUPS)->toContain($s['group']);
        expect($categories)->toContain($s['iucn']['category']);
        expect($statuses)->toContain($s['syriaStatus']);
        expect($s['habitats'])->not->toBeEmpty();
        foreach ($s['habitats'] as $habitat) {
            expect(WILDLIFE_HABITATS)->toContain($habitat);
        }
    }
});

test('every species names at least two https sources and links its IUCN assessment', function () {
    foreach (wildlifeSpecies() as $s) {
        expect(count($s['sources']))->toBeGreaterThanOrEqual(2, $s['slug']);
        foreach ($s['sources'] as $source) {
            expect($source['title'])->not->toBe('');
            expect($source['url'])->toStartWith('https://');
        }
        expect($s['iucn']['url'])->toMatch('#^https://www\.iucnredlist\.org/species/\d+/\d+$#');
    }
});

test('every summary, fact and threat cites a source the species lists', function () {
    foreach (wildlifeSpecies() as $s) {
        $count = count($s['sources']);
        $statements = [['sources' => $s['summarySources'], 'text' => $s['summaryAr']], ...$s['factsAr'], ...$s['threatsAr']];

        expect($s['factsAr'])->not->toBeEmpty();
        foreach ($statements as $statement) {
            expect(trim($statement['text']))->not->toBe('');
            expect($statement['sources'])->not->toBeEmpty("{$s['slug']}: an uncited statement");
            foreach ($statement['sources'] as $index) {
                expect($index)->toBeInt()->toBeGreaterThanOrEqual(0)->toBeLessThan($count, "{$s['slug']}: source {$index} does not exist");
            }
        }
    }
});

test('every governorate a species names exists', function () {
    $ids = array_column(Facts::governorates(), 'id');

    foreach (wildlifeSpecies() as $s) {
        foreach ($s['governorates'] as $id) {
            expect($ids)->toContain($id);
        }
    }
});

test('every photo is freely licensed, credited and captioned', function () {
    foreach (wildlifeSpecies() as $s) {
        $image = $s['image'];
        expect($image['license'])->toMatch(WILDLIFE_LICENSE);
        expect(trim($image['author']))->not->toBe('');
        expect(trim($image['captionAr']))->not->toBe('');
        expect($image['commonsFile'])->not->toStartWith('File:');
        if ($image['license'] === 'Public domain') {
            expect($image['licenseUrl'])->toBeNull();
        } else {
            expect($image['licenseUrl'])->toStartWith('https://');
        }
    }
});

test('every species records when it was last reviewed', function () {
    foreach (wildlifeSpecies() as $s) {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $s['lastReviewed']);
        expect($date)->not->toBeFalse($s['slug']);
        expect($date->format('Y-m-d'))->toBe($s['lastReviewed']);
    }
});
