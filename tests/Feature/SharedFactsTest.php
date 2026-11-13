<?php

use App\Models\Promise;
use App\Support\Facts;

/*
|--------------------------------------------------------------------------
| The server-readable copies in resources/data
|--------------------------------------------------------------------------
|
| `resources/data` is the one fact store for values both languages need. These
| tests pin the two files that are *derived* from an authoring source, so the
| copy the server reads cannot drift from the file the browser loads.
|
*/

test('every governorate has an outline the server can draw', function () {
    $icons = Facts::governorateIcons();

    expect($icons)->not->toBeEmpty();

    foreach (Facts::governorates() as $governorate) {
        $svg = $governorate['transit_svg'];

        expect($icons)->toHaveKey($svg)
            ->and($icons[$svg]['viewBox'])->not->toBe('')
            ->and($icons[$svg]['path'])->not->toBe('');
    }
});

test('the server outline copy matches the svg files the browser loads', function () {
    $files = glob(resource_path('js/Pages/Transit/_data/governorates/*.svg'));

    expect($files)->toBeArray()->not->toBeEmpty();

    $icons = Facts::governorateIcons();

    expect(array_keys($icons))
        ->toEqualCanonicalizing(array_map(fn (string $file): string => basename($file, '.svg'), $files));

    foreach ($files as $file) {
        $raw = (string) file_get_contents($file);
        $key = basename($file, '.svg');

        preg_match('/viewBox="([^"]+)"/', $raw, $viewBox);
        preg_match('/d="([^"]+)"/', $raw, $path);

        // The browser parses `viewBox` and the first path's `d` (the same two
        // values GovernorateIconService returns), so a redrawn outline must
        // regenerate resources/data/governorate-icons.json.
        expect($icons[$key]['viewBox'])->toBe($viewBox[1])
            ->and($icons[$key]['path'])->toBe($path[1]);
    }
});

test('the prayer method table keeps the offered methods separate from the accepted ids', function () {
    $prayer = Facts::prayer();

    expect($prayer['methods'])->not->toBeEmpty()
        ->and($prayer['default_method'])->toBeInt()
        ->and($prayer['unlisted_method_ids'])->toBeArray();

    $offered = array_column($prayer['methods'], 'id');

    expect($offered)->toContain($prayer['default_method'])
        // A stored method the picker does not offer is still a valid id, so it
        // must never be a duplicate of an offered one.
        ->and(array_intersect($offered, $prayer['unlisted_method_ids']))->toBe([]);

    foreach ($prayer['methods'] as $method) {
        expect($method['name_ar'])->not->toBe('')
            ->and($method['detail'])->not->toBe('');
    }
});

test('the open and closed promise statuses partition the status list', function () {
    // Which status is open decides whether the vote countdown applies and
    // whether `resolved_at` is stamped; which is closed freezes votes. The two
    // constants are hand-kept next to a list that lives in promises.json, so
    // this is the check that a status added there is classified instead of
    // becoming neither.
    $statuses = Promise::statuses();

    expect(Promise::OPEN_STATUSES)->not->toBeEmpty()
        ->and(Promise::CLOSED_STATUSES)->not->toBeEmpty()
        ->and(array_intersect(Promise::OPEN_STATUSES, Promise::CLOSED_STATUSES))->toBe([])
        ->and([...Promise::OPEN_STATUSES, ...Promise::CLOSED_STATUSES])
        ->toEqualCanonicalizing($statuses);
});

test('the media base is one readable value', function () {
    expect(Facts::media()['public_base'])->toBeString()
        ->and(Facts::media()['public_base'])->toStartWith('http');
});

test('the theme record is readable through the facts reader', function () {
    $themes = Facts::themes();

    expect($themes['theme']['key'])->toBeString()
        ->and($themes['theme']['system'])->toBeString()
        ->and($themes['font']['key'])->toBeString()
        ->and($themes['themes'])->toBeArray()->not->toBeEmpty();
});
