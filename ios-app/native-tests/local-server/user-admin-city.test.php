<?php

declare(strict_types=1);

require_once __DIR__.'/user-admin-city.php';

$expected = nativeFixtureUserAdminCityData();
if ($expected['id'] !== 'damascus' || $expected['name_ar'] !== 'دمشق' || $expected['name_en'] !== 'Damascus'
    || $expected['zoom'] !== 12 || $expected['status'] !== 'active'
    || $expected['created_at'] !== null || $expected['updated_at'] !== null
    || json_decode($expected['center'], true, flags: JSON_THROW_ON_ERROR) !== ['type' => 'Point', 'coordinates' => [36.2765, 33.5138]]
    || json_decode($expected['bounds'], true, flags: JSON_THROW_ON_ERROR) !== ['type' => 'Polygon', 'coordinates' => [[[35.8, 33.3], [36.8, 33.3], [36.8, 33.7], [35.8, 33.7], [35.8, 33.3]]]]) {
    throw new RuntimeException('The city must match the source Damascus fixture and required model fields.');
}
if (! nativeFixtureUserAdminCityNeedsInsert(null, false) || nativeFixtureUserAdminCityNeedsInsert($expected, false)) {
    throw new RuntimeException('Only an absent city may be inserted; an exact existing baseline must remain unchanged.');
}
$checks = 3;
$cases = [[null, true], [$expected, true]];
foreach ($expected as $key => $value) {
    $changed = $expected;
    $changed[$key] = $value === null ? 'foreign timestamp' : 'foreign content';
    $cases[] = [$changed, false];
}
$missing = $expected;
unset($missing['center']);
$cases[] = [$missing, false];
$cases[] = [[...$expected, 'foreign_column' => 'unexpected'], false];
foreach ($cases as [$row, $collision]) {
    $refused = false;
    try {
        nativeFixtureUserAdminCityNeedsInsert($row, $collision);
    } catch (RuntimeException) {
        $refused = true;
    }
    if (! $refused) {
        throw new RuntimeException('Foreign city data and name collisions must be retained without overwriting.');
    }
    $checks++;
}
echo "User administration city policy: {$checks} checks passed.\n";
