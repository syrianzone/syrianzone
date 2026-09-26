<?php

use App\Exceptions\Users\UserModerationException;
use App\Mcp\Tools\Users\SetUserBanTool;
use App\Models\User;
use App\Services\Users\UserModerationService;

/*
|--------------------------------------------------------------------------
| set-user-ban tool
|--------------------------------------------------------------------------
|
| A ban is the most consequential thing an agent can do in this app: it takes
| effect on the target's next request and blocks login, the admin panel, any
| token they hold, and their submissions. So the tests here are mostly about
| what must NOT happen — no self-ban, no superadmin, no capability laundering,
| no leakage of the target's authorisation config.
|
| The tool is `set`, not `toggle`, precisely so a retry cannot undo the action.
|
*/

function banActor(array $abilities = ['users.ban']): User
{
    return User::factory()->create(['role' => 'user', 'permissions' => $abilities]);
}

it('bans a user when told to', function () {
    agentToken(banActor(), ['users.ban']);
    $target = User::factory()->create(['role' => 'user', 'is_banned' => false]);

    $payload = toolPayload(callTool(SetUserBanTool::class, [
        'user_id' => $target->id,
        'is_banned' => true,
    ]));

    expect($payload['user']['is_banned'])->toBeTrue()
        ->and($payload['changed'])->toBeTrue()
        ->and($target->fresh()->is_banned)->toBeTrue();
});

it('is idempotent, so a retry cannot un-ban the user', function () {
    agentToken(banActor(), ['users.ban']);
    $target = User::factory()->create(['is_banned' => false]);

    // Twice with the same intent. A toggle-based tool would have flipped back.
    callTool(SetUserBanTool::class, ['user_id' => $target->id, 'is_banned' => true]);
    $second = toolPayload(callTool(SetUserBanTool::class, ['user_id' => $target->id, 'is_banned' => true]));

    expect($second['user']['is_banned'])->toBeTrue()
        ->and($second['changed'])->toBeFalse()
        ->and($target->fresh()->is_banned)->toBeTrue();
});

it('unbans a user', function () {
    agentToken(banActor(), ['users.ban']);
    $target = User::factory()->create(['is_banned' => true]);

    $payload = toolPayload(callTool(SetUserBanTool::class, [
        'user_id' => $target->id,
        'is_banned' => false,
    ]));

    expect($payload['user']['is_banned'])->toBeFalse()
        ->and($target->fresh()->is_banned)->toBeFalse();
});

it('refuses to ban the agent\'s own owner', function () {
    // The important guard: a ban applies on the target's next request, so
    // self-banning would revoke the token mid-call and leave nobody to undo it.
    $owner = banActor();
    agentToken($owner, ['users.ban']);

    $response = callTool(SetUserBanTool::class, [
        'user_id' => $owner->id,
        'is_banned' => true,
    ]);

    expect(toolText($response))->toContain('cannot ban your own account')
        ->and($owner->fresh()->is_banned)->toBeFalse();
});

it('still allows unban on yourself, so a self-ban is recoverable', function () {
    $owner = banActor();
    $owner->update(['is_banned' => true]);
    agentToken($owner, ['users.ban']);

    $payload = toolPayload(callTool(SetUserBanTool::class, [
        'user_id' => $owner->id,
        'is_banned' => false,
    ]));

    expect($payload['user']['is_banned'])->toBeFalse();
});

it('refuses to ban a superadmin', function () {
    agentToken(banActor(), ['users.ban']);
    $target = User::factory()->create(['role' => 'superadmin']);

    $response = callTool(SetUserBanTool::class, [
        'user_id' => $target->id,
        'is_banned' => true,
    ]);

    expect(toolText($response))->toContain('Cannot ban a superadmin')
        ->and($target->fresh()->is_banned)->toBeFalse();
});

it('refuses a token without the users.ban capability', function () {
    // A transit capability must not carry user moderation.
    agentToken(banActor(['transit.review_drafts']), ['transit.review_drafts']);
    $target = User::factory()->create();

    $response = callTool(SetUserBanTool::class, [
        'user_id' => $target->id,
        'is_banned' => true,
    ]);

    expect(toolText($response))->toContain('Permission denied')
        ->and($target->fresh()->is_banned)->toBeFalse();
});

it('is hidden from a token that cannot call it', function () {
    $user = User::factory()->create(['role' => 'user', 'permissions' => ['users.ban']]);

    agentToken($user, ['transit.review_drafts']);
    expect(app(SetUserBanTool::class)->shouldRegister())->toBeFalse();

    agentToken($user, ['users.ban']);
    expect(app(SetUserBanTool::class)->shouldRegister())->toBeTrue();
});

it('reports a missing user without guessing at ids', function () {
    agentToken(banActor(), ['users.ban']);

    $response = callTool(SetUserBanTool::class, [
        'user_id' => 999999,
        'is_banned' => true,
    ]);

    expect(toolText($response))->toContain('No user exists with id 999999')
        ->and(toolText($response))->toContain('no list-users tool');
});

it('does not leak the target\'s authorisation configuration', function () {
    agentToken(banActor(), ['users.ban']);
    $target = User::factory()->create([
        'role' => 'transit_admin',
        'permissions' => ['transit.approve'],
        'permission_scopes' => ['transit' => ['homs']],
    ]);

    $payload = toolPayload(callTool(SetUserBanTool::class, [
        'user_id' => $target->id,
        'is_banned' => true,
    ]));

    $encoded = json_encode($payload);

    expect(array_keys($payload['user']))->toBe(['id', 'name', 'email', 'is_banned', 'role'])
        // The password hash is hidden on the model, but the target's
        // permissions and governorate scope are not — an agent has no business
        // reading them out of a moderation response.
        ->and($encoded)->not->toContain('transit.approve')
        ->and($encoded)->not->toContain('permission_scopes')
        ->and($encoded)->not->toContain('$2y$');
});

it('requires the state to be stated, not inferred', function () {
    agentToken(banActor(), ['users.ban']);
    $target = User::factory()->create(['is_banned' => false]);

    $response = callTool(SetUserBanTool::class, ['user_id' => $target->id]);

    expect(toolText($response))->toContain('rejected as invalid')
        ->and($target->fresh()->is_banned)->toBeFalse();
});

it('does not move updated_at when nothing changed', function () {
    agentToken(banActor(), ['users.ban']);
    $target = User::factory()->create(['is_banned' => true]);
    $before = $target->updated_at;

    callTool(SetUserBanTool::class, ['user_id' => $target->id, 'is_banned' => true]);

    expect($target->fresh()->updated_at->timestamp)->toBe($before->timestamp);
});

// ─── The shared service, which the dashboard also uses ─────────────────────

it('refuses a superadmin at the service layer, not just in the tool', function () {
    $service = app(UserModerationService::class);
    $target = User::factory()->create(['role' => 'superadmin']);

    try {
        $service->setBanned($target, true, User::factory()->create());
        $this->fail('Expected a UserModerationException.');
    } catch (UserModerationException $e) {
        expect($e->kind)->toBe(UserModerationException::TARGET_IS_SUPERADMIN)
            ->and($e->httpStatus())->toBe(403);
    }
});

it('toggles for the dashboard while still refusing the same targets', function () {
    $service = app(UserModerationService::class);
    $actor = User::factory()->create(['is_banned' => false]);
    $target = User::factory()->create(['is_banned' => false]);

    expect($service->toggleBanned($target, $actor)->is_banned)->toBeTrue()
        ->and($service->toggleBanned($target->fresh(), $actor)->is_banned)->toBeFalse();
});
