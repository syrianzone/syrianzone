<?php

declare(strict_types=1);

use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;

if (PHP_SAPI !== 'cli') {
    throw new RuntimeException('User fixture preparation is available only to the local test command.');
}
umask(0077);
$runtime = dirname(__DIR__, 2).'/.expo/local-fixture';
$access = json_decode(file_get_contents($runtime.'/access.json'), true, flags: JSON_THROW_ON_ERROR);
$fixture = json_decode(file_get_contents($runtime.'/fixture.json'), true, flags: JSON_THROW_ON_ERROR);
$gate = getenv('SZ_LOCAL_FIXTURE_ACCESS_KEY');
if (! is_string($gate) || strlen($gate) !== 64 || ! hash_equals($access['key'] ?? '', $gate)
    || ($fixture['origin'] ?? null) !== 'https://127.0.0.1:9443'
    || ($fixture['databasePath'] ?? null) !== $runtime.'/database.sqlite'
    || is_link($runtime.'/database.sqlite') || realpath($runtime.'/database.sqlite') !== $runtime.'/database.sqlite'
    || trim(file_get_contents($runtime.'/fixture-marker')) !== 'native-loopback-fixture-v1') {
    throw new RuntimeException('Local user fixture identity verification failed.');
}
require __DIR__.'/bootstrap.php';
set_exception_handler(function (Throwable $exception): void {
    // Laravel's console handler may otherwise report a refusal with exit zero.
    fwrite(STDERR, "Local user fixture preparation refused. No preparation was confirmed.\n");
    exit(1);
});
require_once __DIR__.'/user-admin-city.php';
$writes = [];
DB::listen(function (QueryExecuted $query) use (&$writes): void {
    if (preg_match('/^\s*(insert|update|delete|replace)\b/i', $query->sql, $match)) {
        // Keep only the operation/table classification, never SQL bindings.
        $writes[] = strtolower($match[1]) === 'insert' && str_starts_with($query->sql, 'insert into "cities" ');
    }
});
$city = DB::transaction(function () use (&$writes) {
    $city = nativeFixtureEnsureUserAdminCity();
    if (count($writes) > 1 || in_array(false, $writes, true)) {
        throw new RuntimeException('Only one new city insert is permitted.');
    }

    return $city;
});
echo json_encode([
    'city' => ['id' => $city->id, 'name_ar' => $city->name_ar, 'name_en' => $city->name_en, 'zoom' => $city->zoom, 'status' => $city->status],
    'insertedCities' => count($writes), 'otherDatabaseWrites' => 0,
], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n";
