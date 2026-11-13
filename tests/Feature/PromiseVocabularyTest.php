<?php

use App\Models\Promise;
use App\Models\PromiseSource;
use App\Support\Facts;

/*
|--------------------------------------------------------------------------
| The promise vocabulary
|--------------------------------------------------------------------------
|
| `resources/data/promises.json` is the one record of the promise tracker's
| vocabularies: the keys the server validates and the Arabic label each surface
| prints. The model constants are the validation mirror a few call sites still
| use (the research importer and the MCP tools), so they are pinned here rather
| than left to drift: a key added to one side fails this test until the other
| side has it.
|
*/

test('the model vocabularies match resources/data/promises.json', function () {
    expect(Promise::VENUES)->toBe(Facts::promiseVenues())
        ->and(PromiseSource::TYPES)->toBe(Facts::promiseSourceTypes())
        ->and(Promise::REVIEW_STATUSES)->toBe(Facts::promiseReviewStatuses())
        ->and(Promise::ORIGINS)->toBe(Facts::promiseOrigins());
});

test('every vocabulary entry carries an Arabic label', function (string $list) {
    $rows = Facts::promiseVocabulary($list);

    expect($rows)->not->toBeEmpty();

    foreach ($rows as $row) {
        expect($row)->toHaveKeys(['key', 'label'])
            ->and($row['key'])->toBeString()->not->toBe('')
            ->and($row['label'])->toBeString()->not->toBe('');
        // The client renders these labels directly; Arabic is the product copy.
        expect($row['label'])->toMatch('/\p{Arabic}/u');
    }

    expect(array_column($rows, 'key'))->toBe(array_values(array_unique(array_column($rows, 'key'))));
})->with(['venues', 'source_types', 'review_statuses', 'origins']);
