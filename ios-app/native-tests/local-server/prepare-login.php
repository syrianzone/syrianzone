<?php

declare(strict_types=1);

use App\Models\User;
use Filament\Auth\Pages\Login;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

if (PHP_SAPI !== 'cli') {
    throw new RuntimeException('Login preparation is available only to the local test command.');
}
$runtime = dirname(__DIR__, 2).'/.expo/local-fixture';
$access = json_decode(file_get_contents($runtime.'/access.json'), true, flags: JSON_THROW_ON_ERROR);
$fixture = json_decode(file_get_contents($runtime.'/fixture.json'), true, flags: JSON_THROW_ON_ERROR);
$gate = getenv('SZ_LOCAL_FIXTURE_ACCESS_KEY');
if (! is_string($gate) || strlen($gate) !== 64 || ! hash_equals($access['key'] ?? '', $gate)
    || ($fixture['origin'] ?? null) !== 'https://127.0.0.1:9443'
    || ($fixture['databasePath'] ?? null) !== $runtime.'/database.sqlite'
    || is_link($runtime.'/database.sqlite') || realpath($runtime.'/database.sqlite') !== $runtime.'/database.sqlite'
    || ($fixture['users']['admin']['id'] ?? null) !== 103
    || trim(file_get_contents($runtime.'/fixture-marker')) !== 'native-loopback-fixture-v1') {
    throw new RuntimeException('Local fixture identity verification failed.');
}

$app = require __DIR__.'/bootstrap.php';
if (! $app->environment('testing') || config('app.url') !== 'https://127.0.0.1:9443'
    || DB::connection()->getDriverName() !== 'sqlite'
    || DB::connection()->getDatabaseName() !== $runtime.'/database.sqlite') {
    throw new RuntimeException('Login preparation requires the isolated loopback SQLite fixture.');
}
$admin = User::find(103);
if (! $admin || ! $admin->isSuperAdmin() || $admin->is_banned
    || $admin->email !== 'admin@native-fixture.invalid') {
    throw new RuntimeException('The existing eligible isolated administrator is unavailable.');
}

umask(0077);
$password = bin2hex(random_bytes(32));
$admin->forceFill(['password' => $password])->save();
if (! Hash::check($password, $admin->fresh()->password)) {
    throw new RuntimeException('The isolated administrator password was not persisted.');
}
$temporary = $runtime.'/login.json.next';
file_put_contents($temporary, json_encode(['email' => $admin->email, 'password' => $password], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR)."\n", LOCK_EX);
chmod($temporary, 0600);
rename($temporary, $runtime.'/login.json');

// This is Filament Login's exact shared authenticate/IP bucket, not cache:clear.
$budget = 'livewire-rate-limiter:'.sha1(Login::class.'|authenticate|127.0.0.1');
RateLimiter::clear($budget);
echo "Prepared only isolated admin 103's password and its local login attempt budget.\n";
