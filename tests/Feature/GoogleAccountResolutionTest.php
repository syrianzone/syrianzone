<?php

use App\Http\Controllers\AuthController;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;

function resolveGoogleAccountFixture(string $email): User
{
    return (new ReflectionMethod(AuthController::class, 'upsertAndResolveGoogleUser'))->invoke(
        new AuthController, $email, 'verified-provider-sub', 'Google supplied name', 'https://example.test/google.png',
    );
}

beforeEach(function () {
    Http::preventStrayRequests();
    config(['app.superadmin_email' => '']);
});

test('shared Google resolution preserves intervening account changes instead of replaying stale attributes', function (string $field) {
    $user = User::factory()->superadmin()->create(['email' => 'race@example.test', 'name' => 'Original name', 'avatar_url' => 'https://example.test/old-google.png']);
    $value = match ($field) {
        'role' => 'user',
        'name' => 'Chosen account name',
        'password' => Hash::make('new-account-password'),
        'avatar_url' => "https://example.test/avatars/{$user->id}/new-custom.webp",
    };
    $changed = false;
    Event::listen('eloquent.retrieved: '.User::class, function (User $loaded) use (&$changed, $user, $field, $value) {
        if (! $changed && $loaded->id === $user->id) {
            $changed = true;
            DB::table('users')->where('id', $user->id)->update([$field => $value]);
        }
    });
    $resolved = resolveGoogleAccountFixture($user->email);
    expect($changed)->toBeTrue()->and($user->fresh()->getAttribute($field))->toBe($value)
        ->and($resolved->getAttribute($field))->toBe($value)->and($resolved->google_id)->toBe('verified-provider-sub');
})->with(['role', 'name', 'password', 'avatar_url']);

test('Google role defaults apply only to a newly created account', function () {
    config(['app.superadmin_email' => 'configured@example.test']);
    $existing = User::factory()->create(['email' => 'configured@example.test', 'role' => 'user']);
    expect(resolveGoogleAccountFixture($existing->email)->role)->toBe('user');
    config(['app.superadmin_email' => 'new-admin@example.test']);
    expect(resolveGoogleAccountFixture('new-admin@example.test')->role)->toBe('superadmin');
});

test('shared Google resolution reuses the unique email row and preserves soft-delete restoration policy', function () {
    $first = resolveGoogleAccountFixture('reused@example.test');
    $first->update(['name' => 'Chosen name', 'role' => 'user', 'permissions' => ['places.manage'], 'permission_scopes' => ['transit' => ['damascus']]]);
    $first->delete();
    $restored = resolveGoogleAccountFixture('reused@example.test');
    $again = resolveGoogleAccountFixture('reused@example.test');
    expect($restored->id)->toBe($first->id)->and($again->id)->toBe($first->id)
        ->and($restored->trashed())->toBeFalse()->and($again->name)->toBe('Chosen name')
        ->and($again->permissions)->toBe(['places.manage'])->and($again->permission_scopes)->toBe(['transit' => ['damascus']])
        ->and(User::withTrashed()->where('email', 'reused@example.test')->count())->toBe(1);
});

test('unique-email recovery preserves the winning account instead of applying creation defaults', function () {
    config(['app.superadmin_email' => 'collision@example.test']);
    $collided = false;
    $inserted = false;
    Event::listen('eloquent.creating: '.User::class, function (User $candidate) use (&$collided) {
        if (! $collided && $candidate->email === 'collision@example.test') {
            $collided = true;
            throw new UniqueConstraintViolationException('sqlite', 'insert into users', [], new PDOException('Local concurrent unique-email winner'));
        }
    });
    DB::connection()->beforeExecuting(function (string $sql) use (&$collided, &$inserted) {
        if ($collided && ! $inserted && str_starts_with(strtolower($sql), 'select')) {
            // Publish the competing row when firstOrCreate rereads after its
            // failed savepoint. This stages the framework's unique-race path.
            $inserted = true;
            DB::table('users')->insert([
                'email' => 'collision@example.test', 'name' => 'Concurrent chosen name',
                'role' => 'user', 'password' => Hash::make('concurrent-password'),
            ]);
        }
    });
    $resolved = resolveGoogleAccountFixture('collision@example.test');
    expect($collided)->toBeTrue()->and($inserted)->toBeTrue()
        ->and($resolved->role)->toBe('user')->and($resolved->name)->toBe('Concurrent chosen name')
        ->and(Hash::check('concurrent-password', $resolved->password))->toBeTrue()
        ->and(User::where('email', 'collision@example.test')->count())->toBe(1);
});
