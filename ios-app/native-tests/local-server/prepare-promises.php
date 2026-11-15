<?php

declare(strict_types=1);

use App\Services\Promises\SpeakerDirectory;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;

if (PHP_SAPI !== 'cli') {
    throw new RuntimeException('Promise preparation is available only to the local test command.');
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
    throw new RuntimeException('Local fixture identity verification failed.');
}

require __DIR__.'/bootstrap.php';
require_once __DIR__.'/promise-speaker.php';
$writes = [];
DB::listen(function (QueryExecuted $query) use (&$writes): void {
    if (preg_match('/^\s*(insert|update|delete|replace)\b/i', $query->sql, $match)) {
        // Store only the operation and table, never bindings or SQL contents.
        $writes[] = [strtolower($match[1]), str_contains($query->sql, '"promise_speakers"')];
    }
});
$speaker = nativeFixtureEnsurePromiseSpeaker();
$options = app(SpeakerDirectory::class)->search($speaker->name);
$matches = array_values(array_filter($options, fn (array $row): bool => $row['ref'] === $speaker->ref()));
if (count($matches) !== 1 || $matches[0]['name'] !== $speaker->name || $matches[0]['title'] !== $speaker->title
    || $matches[0]['source'] !== 'speaker' || $matches[0]['pending'] !== false || $matches[0]['image'] !== null
    || count($writes) > 1 || ($writes !== [] && $writes !== [['insert', true]])) {
    throw new RuntimeException('The exact speaker directory contract or single-row write boundary failed.');
}
echo $writes === [] ? "Verified existing synthetic Promise speaker. No database rows changed.\n"
    : "Created only the approved synthetic Promise speaker. Source directory lookup passed.\n";
