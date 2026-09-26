<?php

use App\Models\User;
use App\Support\Agents\TokenIssuer;
use App\Support\Permissions\PermissionCatalogue;

/*
|--------------------------------------------------------------------------
| User banning
|--------------------------------------------------------------------------
|
| Banning used to be authorised by a role list inline in the controller
| (admin / transit_admin / superadmin) and the route was declared inside the
| transit_admin group, which gated by transit capability. So a user holding only
| `transit.review_drafts` could ban anyone, while a role-based check could not
| be granted to one person without granting it to everyone sharing that role.
|
| It is now the `users.ban` capability, in its own general (non-module) group.
|
*/

function banTarget(): User
{
    return User::factory()->create(['role' => 'user', 'is_banned' => false]);
}

it('refuses a transit capability holder from banning a user', function () {
    // The exact over-grant this move exists to close.
    $moderator = User::factory()->create([
        'role' => 'user',
        'permissions' => ['transit.review_drafts'],
    ]);

    $target = banTarget();

    $this->actingAs($moderator)
        ->postJson("/api/v1/admin/users/{$target->id}/toggle-ban")
        ->assertForbidden();

    expect($target->fresh()->is_banned)->toBeFalse();
});

it('refuses the transit_admin role from banning a user', function () {
    // The role used to be on the allow list. It is not a user-moderation role,
    // so the capability has to be granted explicitly now.
    $staff = User::factory()->create(['role' => 'transit_admin', 'permissions' => []]);

    $target = banTarget();

    $this->actingAs($staff)
        ->postJson("/api/v1/admin/users/{$target->id}/toggle-ban")
        ->assertForbidden();

    expect($target->fresh()->is_banned)->toBeFalse();
});

it('lets a users.ban holder ban and unban', function () {
    $staff = User::factory()->create(['role' => 'user', 'permissions' => ['users.ban']]);
    $target = banTarget();

    $this->actingAs($staff)
        ->postJson("/api/v1/admin/users/{$target->id}/toggle-ban")
        ->assertOk()
        ->assertJsonPath('is_banned', true);

    expect($target->fresh()->is_banned)->toBeTrue();

    $this->actingAs($staff)
        ->postJson("/api/v1/admin/users/{$target->id}/toggle-ban")
        ->assertOk()
        ->assertJsonPath('is_banned', false);

    expect($target->fresh()->is_banned)->toBeFalse();
});

it('keeps the users_admin role working', function () {
    $staff = User::factory()->create(['role' => 'users_admin', 'permissions' => []]);
    $target = banTarget();

    $this->actingAs($staff)
        ->postJson("/api/v1/admin/users/{$target->id}/toggle-ban")
        ->assertOk();

    expect($target->fresh()->is_banned)->toBeTrue();
});

it('keeps admin and superadmin working', function () {
    $target = banTarget();

    $this->actingAs(User::factory()->create(['role' => 'admin']))
        ->postJson("/api/v1/admin/users/{$target->id}/toggle-ban")
        ->assertOk();

    $second = banTarget();
    $this->actingAs(User::factory()->create(['role' => 'superadmin']))
        ->postJson("/api/v1/admin/users/{$second->id}/toggle-ban")
        ->assertOk();

    expect($target->fresh()->is_banned)->toBeTrue()
        ->and($second->fresh()->is_banned)->toBeTrue();
});

it('still refuses to ban a superadmin', function () {
    // Domain rule, not authorisation: stays even though the caller may act.
    $staff = User::factory()->create(['role' => 'user', 'permissions' => ['users.ban']]);
    $target = User::factory()->create(['role' => 'superadmin']);

    $this->actingAs($staff)
        ->postJson("/api/v1/admin/users/{$target->id}/toggle-ban")
        ->assertForbidden()
        ->assertJsonPath('message', 'Cannot ban a superadmin');

    expect($target->fresh()->is_banned)->toBeFalse();
});

it('404s on a user that does not exist', function () {
    $staff = User::factory()->create(['role' => 'user', 'permissions' => ['users.ban']]);

    $this->actingAs($staff)
        ->postJson('/api/v1/admin/users/999999/toggle-ban')
        ->assertNotFound();
});

it('registers users.ban as a real, grantable capability', function () {
    expect(PermissionCatalogue::isKnown('users.ban'))->toBeTrue()
        ->and(PermissionCatalogue::forModule('users'))->toBe(['users.ban'])
        ->and(PermissionCatalogue::groupMeta())->toHaveKey('users')
        ->and(PermissionCatalogue::label('users.ban'))->not->toBe('users.ban');

    // And a token can be minted carrying it, so an agent could hold it too if a
    // tool ever uses it.
    $owner = User::factory()->create(['role' => 'admin']);
    $issued = app(TokenIssuer::class)->issue($owner, 'mod', ['users.ban']);

    expect($issued['token']->accessToken->abilities)->toBe(['users.ban']);
});

it('is granted by the wildcard', function () {
    $staff = User::factory()->create(['role' => 'user', 'permissions' => ['*']]);
    $target = banTarget();

    $this->actingAs($staff)
        ->postJson("/api/v1/admin/users/{$target->id}/toggle-ban")
        ->assertOk();
});
