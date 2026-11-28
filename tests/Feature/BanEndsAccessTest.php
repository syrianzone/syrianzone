<?php

use App\Models\User;
use App\Services\Users\UserModerationService;
use Illuminate\Support\Facades\DB;

// Login refuses banned users, but credentials issued before a ban used to
// outlive it. A ban has to end the access the user already holds.

test('banning deletes the user\'s tokens, sessions and remember-me token', function () {
    $user = User::factory()->create(['remember_token' => 'old-remember-token']);
    $user->createToken('phone', ['mobile']);
    $user->createToken('agent', ['places.view']);
    DB::table('sessions')->insert([
        'id' => 'session-of-banned-user',
        'user_id' => $user->id,
        'payload' => '',
        'last_activity' => now()->timestamp,
    ]);
    config(['session.driver' => 'database']);

    app(UserModerationService::class)->setBanned($user, true);

    expect($user->tokens()->count())->toBe(0)
        ->and(DB::table('sessions')->where('user_id', $user->id)->exists())->toBeFalse()
        ->and($user->fresh()->remember_token)->not->toBe('old-remember-token');
});

test('unbanning does not touch credentials', function () {
    $user = User::factory()->create(['is_banned' => true]);
    $user->createToken('phone', ['mobile']);

    app(UserModerationService::class)->setBanned($user, false);

    expect($user->tokens()->count())->toBe(1);
});

test('a token whose owner is banned no longer authenticates', function () {
    $user = User::factory()->create();
    $token = $user->createToken('phone', ['mobile'])->plainTextToken;

    // Set directly, as any path that bypasses the service would.
    DB::table('users')->where('id', $user->id)->update(['is_banned' => true]);

    $this->withToken($token)->getJson('/api/v1/user')->assertUnauthorized();
});

test('a session opened before the ban is ended on the next web request', function () {
    $user = User::factory()->create();
    $this->actingAs($user);
    $user->is_banned = true;
    $user->save();

    $this->get('/dashboard')->assertRedirect('/?error=banned');
    $this->assertGuest('web');
});

test('a session opened before the ban is refused on admin JSON routes', function () {
    $staff = User::factory()->create(['role' => 'user', 'permissions' => ['users.ban']]);
    $target = User::factory()->create();
    $this->actingAs($staff);
    $staff->is_banned = true;
    $staff->save();

    $this->postJson("/api/v1/admin/users/{$target->id}/toggle-ban")->assertForbidden();
    expect($target->fresh()->is_banned)->toBeFalse();
});

test('the admin users console bans through the moderation service', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $target = User::factory()->create();
    $target->createToken('phone', ['mobile']);

    $this->actingAs($superadmin)
        ->putJson("/api/v1/admin/users/{$target->id}", [
            'name' => $target->name,
            'email' => $target->email,
            'role' => $target->role,
            'is_banned' => true,
        ])
        ->assertOk();

    expect($target->fresh()->is_banned)->toBeTrue()
        ->and($target->tokens()->count())->toBe(0);
});

test('the admin users console cannot ban a superadmin', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $other = User::factory()->create(['role' => 'superadmin']);

    $this->actingAs($superadmin)
        ->putJson("/api/v1/admin/users/{$other->id}", [
            'name' => $other->name,
            'email' => $other->email,
            'role' => 'superadmin',
            'is_banned' => true,
        ])
        ->assertForbidden();

    expect($other->fresh()->is_banned)->toBeFalse();
});
