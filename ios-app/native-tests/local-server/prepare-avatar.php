<?php

declare(strict_types=1);

use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;

if (PHP_SAPI !== 'cli') {
    throw new RuntimeException('Avatar preparation is available only to the local test command.');
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
    throw new RuntimeException('Local avatar fixture identity verification failed.');
}
require __DIR__.'/bootstrap.php';
set_exception_handler(function (Throwable $exception): void {
    fwrite(STDERR, 'Avatar preparation refused: '.$exception->getMessage()."\n");
    exit(1);
});
require_once __DIR__.'/avatar-user.php';
$writes = [];
DB::listen(function (QueryExecuted $query) use (&$writes): void {
    if (preg_match('/^\s*(insert|update|delete|replace)\b/i', $query->sql, $match)) {
        $writes[] = strtolower($match[1]) === 'insert' && str_starts_with($query->sql, 'insert into "users" ');
    }
});
$user = nativeFixtureEnsureAvatarUser($fixture['users']['avatar'] ?? null);
if (count($writes) > 1 || in_array(false, $writes, true)) {
    throw new RuntimeException('Only a single new disposable user insert is permitted.');
}
$fixture['users']['avatar'] = ['id' => 105, 'name' => $user->name, 'email' => $user->email, 'token' => $fixture['users']['avatar']['token'] ?? ''];
$temporary = $runtime.'/avatar-config-'.bin2hex(random_bytes(8)).'.json';
file_put_contents($temporary, json_encode($fixture, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n", LOCK_EX);
chmod($temporary, 0600);
rename($temporary, $runtime.'/fixture.json');
echo $writes === [] ? "Verified pristine disposable avatar user 105. No database row changed.\n"
    : "Created only disposable synthetic avatar user 105. No other database row or cache entry changed.\n";
