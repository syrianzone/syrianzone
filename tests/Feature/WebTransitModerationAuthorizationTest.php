<?php

use App\Http\Middleware\AutoLoginDevUser;
use App\Models\User;

test('web transit moderation protects self and privileged targets', function (
    string $targetRole,
    bool $self,
    string $expectedCode,
) {
    $actor = User::factory()->create(['role' => 'transit_admin']);
    $target = $self
        ? $actor
        : User::factory()->create(['role' => $targetRole]);

    $this->withoutMiddleware(AutoLoginDevUser::class)
        ->actingAs($actor)
        ->postJson("/api/admin/users/{$target->id}/toggle-ban")
        ->assertForbidden()
        ->assertJsonPath('code', $expectedCode);

    expect($target->fresh()->is_banned)->toBeFalse();
})->with([
    'self' => ['transit_admin', true, 'cannot_ban_self'],
    'peer transit administrator' => ['transit_admin', false, 'insufficient_target_role'],
    'core administrator' => ['admin', false, 'insufficient_target_role'],
    'superadmin' => ['superadmin', false, 'protected_superadmin'],
]);

test('web transit moderation allows lower-role targets and revokes their tokens', function (
    string $actorRole,
    string $targetRole,
) {
    $actor = User::factory()->create(['role' => $actorRole]);
    $target = User::factory()->create(['role' => $targetRole]);
    $target->createToken('mobile:moderation-target', ['mobile']);

    $this->withoutMiddleware(AutoLoginDevUser::class)
        ->actingAs($actor)
        ->postJson("/api/admin/users/{$target->id}/toggle-ban", ['is_banned' => true])
        ->assertOk()
        ->assertJsonPath('is_banned', true);

    expect($target->fresh()->is_banned)->toBeTrue()
        ->and($target->tokens()->count())->toBe(0);
})->with([
    'transit administrator to contributor' => ['transit_admin', 'user'],
    'administrator to transit administrator' => ['admin', 'transit_admin'],
    'superadmin to administrator' => ['superadmin', 'admin'],
]);
