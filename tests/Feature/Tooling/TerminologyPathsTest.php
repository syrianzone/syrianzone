<?php

use Symfony\Component\Yaml\Yaml;

/**
 * `.terminology.json` holds the checked paths; `.pre-commit-config.yaml` needs
 * the same list as a `files:` regex, because pre-commit has no way to read the
 * JSON. Rather than trusting a hand copy, this test rebuilds the regex from the
 * JSON and fails until the YAML matches, so a renamed Quran file cannot leave the
 * hook checking a path that no longer exists.
 */

/** The `files:` regex that .terminology.json's paths imply. */
function terminologyFilesRegex(): string
{
    $config = json_decode((string) file_get_contents(base_path('.terminology.json')), true, flags: JSON_THROW_ON_ERROR);
    $absolute = fn (string $path) => '^'.preg_quote($path, '#');

    $alternatives = array_map(
        // A path with an extension is one file; anything else is a directory
        // whose whole subtree is checked.
        fn (string $path) => str_contains(basename($path), '.') ? $absolute($path).'$' : $absolute($path).'/',
        $config['paths'],
    );

    return implode('|', $alternatives);
}

test('every checked path still exists', function () {
    $config = json_decode((string) file_get_contents(base_path('.terminology.json')), true, flags: JSON_THROW_ON_ERROR);

    foreach ($config['paths'] as $path) {
        expect(file_exists(base_path($path)))
            ->toBeTrue("resources/.terminology.json lists {$path}, which no longer exists.");
    }
});

test('the pre-commit hook checks exactly the paths .terminology.json lists', function () {
    $yaml = Yaml::parseFile(base_path('.pre-commit-config.yaml'));
    $expected = terminologyFilesRegex();

    $filters = collect($yaml['repos'])->flatMap(fn (array $repo) => $repo['hooks'] ?? [])
        ->pluck('files')
        ->filter()
        ->values()
        ->all();

    expect($filters)->not->toBe([], '.pre-commit-config.yaml has no hook with a files: filter.');
    foreach ($filters as $filter) {
        expect($filter)->toBe($expected);
    }
});
