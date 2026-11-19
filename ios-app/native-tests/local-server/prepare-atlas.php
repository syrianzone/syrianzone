<?php

declare(strict_types=1);

use App\Services\Population\PopulationCache;
use Illuminate\Cache\DatabaseStore;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

if (PHP_SAPI !== 'cli') {
    throw new RuntimeException('Atlas preparation is available only to the local test command.');
}
$runtime = dirname(__DIR__, 2).'/.expo/local-fixture';
$access = json_decode(file_get_contents($runtime.'/access.json'), true, flags: JSON_THROW_ON_ERROR);
$fixture = json_decode(file_get_contents($runtime.'/fixture.json'), true, flags: JSON_THROW_ON_ERROR);
$gate = getenv('SZ_LOCAL_FIXTURE_ACCESS_KEY');
if (! is_string($gate) || strlen($gate) !== 64 || ! hash_equals($access['key'] ?? '', $gate)
    || ($fixture['origin'] ?? null) !== 'https://127.0.0.1:9443'
    || ($fixture['databasePath'] ?? null) !== $runtime.'/database.sqlite'
    || is_link($runtime.'/database.sqlite') || realpath($runtime.'/database.sqlite') !== $runtime.'/database.sqlite'
    || trim(file_get_contents($runtime.'/fixture-marker')) !== 'native-loopback-fixture-v1') {
    throw new RuntimeException('Local Atlas fixture identity verification failed.');
}

require __DIR__.'/bootstrap.php';
set_exception_handler(function (Throwable $exception): void {
    fwrite(STDERR, 'Local Atlas preparation refused: '.$exception->getMessage()."\n");
    exit(1);
});
require_once __DIR__.'/atlas-baseline.php';
if (config('cache.default') !== 'database' || ! Cache::getStore() instanceof DatabaseStore
    || config('cache.stores.database.table') !== 'cache'
    || Cache::getStore()->getConnection()->getDatabaseName() !== $runtime.'/database.sqlite') {
    throw new RuntimeException('Atlas preparation requires the existing isolated database cache.');
}
$writes = [];
$exactCacheKey = Cache::getStore()->getPrefix().PopulationCache::MASTER;
DB::listen(function (QueryExecuted $query) use (&$writes, $exactCacheKey): void {
    if (! preg_match('/^\s*(insert|update|delete|replace)\b/i', $query->sql, $match)) {
        return;
    }
    $validInsert = strtolower($match[1]) === 'insert' && preg_match('/^insert into "pop_(demographics|rainfall)" /i', $query->sql);
    $validCacheDelete = $query->sql === 'delete from "cache" where "key" = ?' && $query->bindings === [$exactCacheKey];
    // Inspect bindings in memory only; record no SQL, keys, values, or credentials.
    $writes[] = $validInsert ? 'baseline-insert' : ($validCacheDelete ? 'master-cache-delete' : 'unexpected');
});
$result = nativeFixtureEnsureAtlas();
// Root explicitly authorized only this derived local key after verified insertion.
// Keep an already-correct cached report intact on an idempotent repeat.
$entry = DB::table('cache')->where('key', $exactCacheKey)->first();
// Read the framework's SQLite array serialization without its expiry deletion,
// which also touches a flexible-cache companion key in this Laravel version.
$cached = $entry === null ? null : @unserialize($entry->value, ['allowed_classes' => false]);
$source = is_array($cached) ? array_values(array_filter($cached['groups']['population'] ?? [], fn (array $row): bool => ($row['source_id'] ?? null) === 910001)) : [];
$visible = count($source) === 1 && ($source[0]['cities'] ?? null) === ['Damascus' => 120000, 'Aleppo' => 340000]
    && ($source[0]['note'] ?? null) === 'بيانات اصطناعية للاختبار المحلي: ليست إحصاءات حقيقية'
    && ($source[0]['date'] ?? null) === '2025-01-01' && array_key_exists('source_url', $source[0]) && $source[0]['source_url'] === null
    && ($cached['rainfall_data']['SY01'] ?? null) == [['year' => 2024, 'rainfall' => 110.0, 'rainfall_avg' => 100.0], ['year' => 2025, 'rainfall' => 130.0, 'rainfall_avg' => 100.0]]
    && ($cached['rainfall_data']['SY02'] ?? null) == [['year' => 2024, 'rainfall' => 220.0, 'rainfall_avg' => 200.0], ['year' => 2025, 'rainfall' => 260.0, 'rainfall_avg' => 200.0]];
if (! $visible && $entry !== null) {
    DB::table('cache')->where('key', $exactCacheKey)->delete();
}
if (in_array('unexpected', $writes, true) || count(array_filter($writes, fn (string $item): bool => $item === 'master-cache-delete')) > 1
    || count(array_filter($writes, fn (string $item): bool => $item === 'baseline-insert')) !== $result['demographicRowsCreated'] + $result['rainfallRowsCreated']) {
    throw new RuntimeException('The local Atlas write boundary was exceeded.');
}
echo 'Verified synthetic Atlas source 910001: '.$result['demographicRowsCreated'].' population rows and '.$result['rainfallRowsCreated']." rainfall rows created.\n";
echo $visible ? "The existing master report already matches; no cache entry changed.\n" : "Only the derived local population_master entry was invalidated if present.\n";
