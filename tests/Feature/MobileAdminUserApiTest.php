<?php

use App\Models\User;

function mobileUserAdminBearer(User $user): string
{
    return $user->createToken('mobile:user-admin-test', ['mobile'])->plainTextToken;
}

test('mobile user administration requires mobile bearer provenance and a superadmin', function () {
    $user = User::factory()->create(['role' => 'user']);
    $admin = User::factory()->create(['role' => 'admin']);
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $wildcard = $superadmin->createToken('browser', ['*'])->plainTextToken;

    $this->getJson('/api/mobile/admin/users')->assertUnauthorized();
    $this->withToken($wildcard)->getJson('/api/mobile/admin/users')->assertUnauthorized();
    $this->withToken(mobileUserAdminBearer($user))->getJson('/api/mobile/admin/users')->assertForbidden();
    $this->withToken(mobileUserAdminBearer($admin))->getJson('/api/mobile/admin/users')->assertForbidden();
    $this->withToken($wildcard)
        ->postJson("/api/mobile/admin/users/{$user->id}/toggle-ban", ['is_banned' => true])
        ->assertUnauthorized();
    $this->withToken(mobileUserAdminBearer($user))
        ->postJson("/api/mobile/admin/users/{$admin->id}/toggle-ban", ['is_banned' => true])
        ->assertForbidden();
});

test('mobile superadmins list create and delete bounded user records', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $token = mobileUserAdminBearer($superadmin);

    $this->withToken($token)->getJson('/api/mobile/admin/users')
        ->assertOk()
        ->assertJsonPath('data.0.id', $superadmin->id)
        ->assertJsonMissingPath('data.0.password');

    $created = $this->withToken($token)->postJson('/api/mobile/admin/users', [
        'email' => 'reviewer@example.test',
        'name' => 'Transit reviewer',
        'role' => 'transit_admin',
    ])->assertCreated()
        ->assertJsonPath('data.email', 'reviewer@example.test')
        ->assertJsonPath('data.role', 'transit_admin')
        ->assertJsonPath('data.is_banned', false)
        ->json('data.id');

    $this->withToken($token)->deleteJson("/api/mobile/admin/users/{$created}")
        ->assertOk()
        ->assertExactJson(['data' => ['deleted' => true]]);

    expect(User::withTrashed()->findOrFail($created)->deleted_at)->not->toBeNull();
});

test('mobile user administration protects superadmins and validates role assignments', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $otherSuperadmin = User::factory()->create(['role' => 'superadmin']);
    $token = mobileUserAdminBearer($superadmin);

    $this->withToken($token)->postJson('/api/mobile/admin/users', [
        'email' => 'root@example.test',
        'name' => 'Root',
        'role' => 'superadmin',
    ])->assertUnprocessable()->assertJsonValidationErrors('role');

    $this->withToken($token)->deleteJson("/api/mobile/admin/users/{$otherSuperadmin->id}")
        ->assertForbidden()
        ->assertJsonPath('code', 'protected_superadmin');
});

test('mobile user creation normalizes email before checking uniqueness', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    User::factory()->create(['email' => 'reviewer@example.test', 'role' => 'user']);

    $this->withToken(mobileUserAdminBearer($superadmin))->postJson('/api/mobile/admin/users', [
        'email' => 'REVIEWER@EXAMPLE.TEST',
        'name' => 'Duplicate reviewer',
        'role' => 'transit_admin',
    ])->assertUnprocessable()->assertJsonValidationErrors('email');
});

test('mobile transit reviewers toggle contributor bans but cannot ban themselves or superadmins', function (string $role) {
    $reviewer = User::factory()->create(['role' => $role]);
    $contributor = User::factory()->create(['role' => 'user']);
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $token = mobileUserAdminBearer($reviewer);

    $this->withToken($token)->postJson("/api/mobile/admin/users/{$contributor->id}/toggle-ban")
        ->assertOk()
        ->assertJsonPath('data.user.is_banned', true);
    expect($contributor->fresh()->is_banned)->toBeTrue();

    $this->withToken($token)->postJson("/api/mobile/admin/users/{$reviewer->id}/toggle-ban")
        ->assertForbidden()
        ->assertJsonPath('code', 'cannot_ban_self');
    $this->withToken($token)->postJson("/api/mobile/admin/users/{$superadmin->id}/toggle-ban")
        ->assertForbidden()
        ->assertJsonPath('code', 'protected_superadmin');
})->with(['admin', 'transit_admin', 'superadmin']);

test('mobile user moderation follows the reviewer role hierarchy', function (string $actorRole, string $targetRole, bool $allowed) {
    $actor = User::factory()->create(['role' => $actorRole]);
    $target = User::factory()->create(['role' => $targetRole]);
    $response = $this->withToken(mobileUserAdminBearer($actor))
        ->postJson("/api/mobile/admin/users/{$target->id}/toggle-ban", ['is_banned' => true]);

    if ($allowed) {
        $response->assertOk();
        expect($target->fresh()->is_banned)->toBeTrue();

        return;
    }

    $response->assertForbidden()->assertJsonPath('code', 'insufficient_target_role');
    expect($target->fresh()->is_banned)->toBeFalse();
})->with([
    'transit reviewer to contributor' => ['transit_admin', 'user', true],
    'transit reviewer to peer' => ['transit_admin', 'transit_admin', false],
    'transit reviewer to administrator' => ['transit_admin', 'admin', false],
    'administrator to transit reviewer' => ['admin', 'transit_admin', true],
    'administrator to peer' => ['admin', 'admin', false],
    'superadmin to administrator' => ['superadmin', 'admin', true],
]);

test('mobile user moderation is idempotent, revokes tokens, and returns bounded account state', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $target = User::factory()->create(['role' => 'admin']);
    $target->createToken('browser', ['*']);
    $target->createToken('mobile:target', ['mobile']);
    $token = mobileUserAdminBearer($superadmin);

    $expected = [
        'data' => [
            'user' => [
                'id' => $target->id,
                'is_banned' => true,
                'name' => $target->name,
            ],
        ],
    ];

    $this->withToken($token)
        ->postJson("/api/mobile/admin/users/{$target->id}/toggle-ban", ['is_banned' => true])
        ->assertOk()
        ->assertExactJson($expected);
    expect($target->tokens()->count())->toBe(0);

    $this->withToken($token)
        ->postJson("/api/mobile/admin/users/{$target->id}/toggle-ban", ['is_banned' => true])
        ->assertOk()
        ->assertExactJson($expected);
    expect($target->fresh()->is_banned)->toBeTrue();

    $this->withToken($token)
        ->postJson("/api/mobile/admin/users/{$target->id}/toggle-ban", ['is_banned' => false])
        ->assertOk()
        ->assertJsonPath('data.user.is_banned', false);
    expect($target->fresh()->is_banned)->toBeFalse();
});
