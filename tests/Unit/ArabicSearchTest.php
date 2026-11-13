<?php

use App\Support\ArabicSearch;
use App\Support\Facts;

/*
|--------------------------------------------------------------------------
| The one Arabic fold
|--------------------------------------------------------------------------
|
| Every Arabic comparison in the app folds with `ArabicSearch::fold()`, and the
| browser folds with the same rules in `resources/js/Lib/arabic.ts`. Both tests
| read `resources/data/search-fold.json`, so a rule added on one side without
| the other fails here instead of silently matching different rows.
|
*/

test('the shared fold table holds', function () {
    $cases = Facts::json('search-fold');

    expect($cases)->not->toBeEmpty();

    foreach ($cases as $case) {
        expect(ArabicSearch::fold($case['input']))
            ->toBe($case['fold'], $case['note'].' ('.json_encode($case['input'], JSON_UNESCAPED_UNICODE).')');
    }
});

test('a governorate spelling folds through the same rule', function () {
    // Facts::normalizeName() is the governorate alias key: it must be the one
    // fold, not a second copy of it.
    expect(Facts::normalizeName('  ريف دمشق '))->toBe(ArabicSearch::fold('ريف دمشق'))
        ->and(Facts::normalizeName('حَمَاة'))->toBe('حماه')
        ->and(Facts::governorateByAnyName('حماه')['id'] ?? null)->toBe('hama')
        ->and(Facts::governorateByAnyName('ريف دمشق')['id'] ?? null)->toBe('rural-damascus');
});

test('a name compares without its spelling variants', function () {
    expect(ArabicSearch::fold('مؤسسة'))->toBe(ArabicSearch::fold('موسسه'))
        ->and(ArabicSearch::fold('صلاة'))->toBe(ArabicSearch::fold('صلاه'))
        ->and(ArabicSearch::fold('أحمد'))->toBe(ArabicSearch::fold('احمد'))
        ->and(ArabicSearch::fold('مقهى'))->toBe(ArabicSearch::fold('مقهي'));
});
