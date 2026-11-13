<?php

use App\Support\Permissions\PermissionCatalogue;

/*
|--------------------------------------------------------------------------
| Capability list parity
|--------------------------------------------------------------------------
|
| `resources/data/capabilities.json` is the list the TypeScript side imports,
| so a capability id written in React is a compile error unless it is in the
| catalogue. The two lists are kept equal here rather than by a second PHP
| export: the JSON is the artefact both languages read, and this test is what
| fails the build when one side is edited alone.
|
*/

it('keeps the shared capability list equal to the catalogue', function () {
    $path = resource_path('data/capabilities.json');

    expect(file_exists($path))->toBeTrue("{$path} is missing");

    $listed = array_keys(json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR));

    $catalogue = PermissionCatalogue::all();

    sort($listed);
    sort($catalogue);

    expect($listed)->toBe($catalogue);
});
