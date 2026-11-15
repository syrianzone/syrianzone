<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Support\Facades\DB;

function nativeFixtureAvatarIdentity(User $user): array
{
    return [
        'id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role,
        'permissions' => $user->permissions, 'permission_scopes' => $user->permission_scopes,
        'is_banned' => (bool) $user->is_banned, 'google_id' => $user->google_id,
        'avatar_url' => $user->avatar_url, 'deleted_at' => $user->deleted_at,
        'verified' => $user->email_verified_at !== null,
    ];
}

function nativeFixtureAssertAvatarIdentity(array $row, bool $pristine): void
{
    $expected = [
        'id' => 105, 'name' => 'حساب الصورة التجريبي المحلي', 'email' => 'avatar@native-fixture.invalid',
        'role' => 'user', 'permissions' => [], 'permission_scopes' => null, 'is_banned' => false,
        'google_id' => null, 'deleted_at' => null, 'verified' => true,
    ];
    foreach ($expected as $key => $value) {
        if (! array_key_exists($key, $row) || $row[$key] !== $value) {
            throw new RuntimeException('The disposable avatar identity is foreign, modified or deleted. No account was overwritten or restored.');
        }
    }
    if (! array_key_exists('avatar_url', $row)) {
        throw new RuntimeException('The exact disposable avatar state is required.');
    }
    $avatar = $row['avatar_url'];
    if (($pristine && $avatar !== null) || ($avatar !== null && (! is_string($avatar)
        || preg_match('#^/storage/avatars/105/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$#D', $avatar) !== 1))) {
        throw new RuntimeException('The disposable avatar is not pristine or does not belong to this exact local user.');
    }
}

function nativeFixtureAvatarCreationAllowed(?array $owner, bool $rowExists): bool
{
    if ($owner === null) {
        if ($rowExists) {
            throw new RuntimeException('User 105 has no matching local fixture ownership record.');
        }

        return true;
    }
    if (($owner['id'] ?? null) !== 105 || ($owner['email'] ?? null) !== 'avatar@native-fixture.invalid'
        || ($owner['name'] ?? null) !== 'حساب الصورة التجريبي المحلي') {
        throw new RuntimeException('The disposable account ownership record has conflicting content.');
    }
    if (! $rowExists) {
        throw new RuntimeException('Recorded user 105 is missing. A separately authorized controlled reset is required.');
    }

    return false;
}

function nativeFixtureEnsureAvatarUser(?array $owner): User
{
    $runtime = dirname(__DIR__, 2).'/.expo/local-fixture';
    if (PHP_SAPI !== 'cli' || ! app()->environment('testing') || config('app.url') !== 'https://127.0.0.1:9443'
        || DB::connection()->getDriverName() !== 'sqlite' || DB::connection()->getDatabaseName() !== $runtime.'/database.sqlite'
        || is_link($runtime.'/database.sqlite') || realpath($runtime.'/database.sqlite') !== $runtime.'/database.sqlite'
        || trim(file_get_contents($runtime.'/fixture-marker')) !== 'native-loopback-fixture-v1') {
        throw new RuntimeException('Avatar preparation requires the exact isolated local testing database.');
    }

    return DB::transaction(function () use ($owner): User {
        if (User::withTrashed()->where('email', 'avatar@native-fixture.invalid')->whereKeyNot(105)->exists()) {
            throw new RuntimeException('Another account owns the synthetic avatar email.');
        }
        $user = User::withTrashed()->whereKey(105)->lockForUpdate()->first();
        if (nativeFixtureAvatarCreationAllowed($owner, $user !== null)) {
            $user = User::factory()->make([
                'id' => 105, 'name' => 'حساب الصورة التجريبي المحلي', 'email' => 'avatar@native-fixture.invalid',
                'role' => 'user', 'permissions' => [], 'permission_scopes' => null, 'settings' => [],
                'password' => bin2hex(random_bytes(32)), 'remember_token' => null,
                'google_id' => null, 'avatar_url' => null, 'is_banned' => false,
            ]);
            $user->saveQuietly();
        }
        nativeFixtureAssertAvatarIdentity(nativeFixtureAvatarIdentity($user), true);

        return $user;
    });
}
