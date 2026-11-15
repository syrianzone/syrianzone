<?php

declare(strict_types=1);

require_once __DIR__.'/atlas-baseline.php';

$checks = 0;
function atlasCheck(bool $condition, string $message): void
{
    global $checks;
    $checks++;
    if (! $condition) {
        throw new RuntimeException($message);
    }
}
function atlasRefuses(callable $action): void
{
    try {
        $action();
    } catch (RuntimeException) {
        atlasCheck(true, 'Expected conflict refusal.');

        return;
    }
    atlasCheck(false, 'A conflicting Atlas row must never be overwritten.');
}

$expected = nativeFixtureAtlasRows();
$plan = nativeFixtureAtlasPlan([], []);
atlasCheck(count($plan['demographics']) === 2 && count($plan['rainfall']) === 4, 'Empty data requires exactly six rows.');
atlasCheck($expected['demographics'][0]['value'] === 120000 && $expected['demographics'][1]['value'] === 340000, 'The synthetic population contract is explicit.');
atlasCheck($expected['rainfall'][0]['rainfall'] === 110.0 && $expected['rainfall'][3]['rainfall'] === 260.0, 'The synthetic rainfall contract is explicit.');
atlasCheck(nativeFixtureAtlasPlan($expected['demographics'], $expected['rainfall']) === ['demographics' => [], 'rainfall' => []], 'An exact repeat must plan zero inserts.');
$partial = nativeFixtureAtlasPlan([$expected['demographics'][0]], [$expected['rainfall'][0]]);
atlasCheck(count($partial['demographics']) === 1 && count($partial['rainfall']) === 3, 'A partial baseline plans only missing rows.');
$other = $expected['demographics'][0];
$other['id'] = 1;
$other['source_id'] = 2;
$other['value'] = 99;
atlasCheck(count(nativeFixtureAtlasPlan([$other], [])['demographics']) === 2, 'Unrelated source rows remain untouched.');
foreach (['value' => 120001, 'note' => 'Foreign content', 'created_at' => '2025-01-01 00:00:00'] as $field => $value) {
    $row = $expected['demographics'][0];
    $row[$field] = $value;
    atlasRefuses(fn () => nativeFixtureAtlasPlan([$row], []));
}
$row = $expected['demographics'][0];
$row['id'] = 3;
atlasRefuses(fn () => nativeFixtureAtlasPlan([$row], []));
$row = $expected['demographics'][0];
$row['id'] = 3;
$row['city_name'] = 'Homs';
atlasRefuses(fn () => nativeFixtureAtlasPlan([$row], []));
$row = $expected['demographics'][0];
$row['id'] = 3;
$row['data_type'] = 'idp';
atlasRefuses(fn () => nativeFixtureAtlasPlan([$row], []));
$row = $expected['rainfall'][0];
$row['id'] = 3;
atlasRefuses(fn () => nativeFixtureAtlasPlan([], [$row]));
$row = $expected['rainfall'][0];
$row['rainfall_avg'] = 101.0;
atlasRefuses(fn () => nativeFixtureAtlasPlan([], [$row]));
$row = $expected['rainfall'][0];
unset($row['updated_at']);
atlasRefuses(fn () => nativeFixtureAtlasPlan([], [$row]));
echo "Synthetic Atlas plan: {$checks} checks passed.\n";
