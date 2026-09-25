<?php

use App\Filament\Resources\UserResource;
use App\Models\User;
use App\Support\Agents\AgentAuthorizer;
use App\Support\Agents\InvalidTokenAbilities;
use App\Support\Agents\TokenIssuer;
use App\Support\Permissions\PermissionCatalogue;
use Laravel\Sanctum\PersonalAccessToken;

/*
|--------------------------------------------------------------------------
| The permission ceiling
|--------------------------------------------------------------------------
|
| The invariant under test: effective = user's live permission AND the token's
| abilities. Both sides must pass. These tests exist because each failure mode
| below is silent and plausible — a token that grants more than its owner, or
| one that keeps working after the grant is revoked.
|
*/

test('a token can never grant a capability its owner does not have', function () {
    $user = agentUser(['permissions' => ['places.review']]);

    $issued = app(TokenIssuer::class)->issue($user, 'clamped', [
        'places.review',
        'places.approve',
        'places.delete',
    ]);

    expect($issued['abilities'])->toBe(['places.review'])
        ->and($issued['dropped'])->toContain('places.approve', 'places.delete');
});

test('issuing a wildcard token throws', function () {
    $super = agentUser(['role' => 'superadmin']);

    expect(fn () => app(TokenIssuer::class)->issue($super, 'god', ['*']))
        ->toThrow(InvalidTokenAbilities::class);
});

test('unknown capability ids are dropped rather than persisted', function () {
    $super = agentUser(['role' => 'superadmin']);

    $issued = app(TokenIssuer::class)->issue($super, 'typo', [
        'places.approve',
        'places.approv',
        'transit.teleport',
    ]);

    expect($issued['abilities'])->toBe(['places.approve'])
        ->and($issued['dropped'])->toBe(['places.approv', 'transit.teleport']);
});

test('a superadmin token is bounded by its abilities, not by role', function () {
    $super = agentUser(['role' => 'superadmin']);
    $token = agentToken($super, ['places.approve']);

    $authorizer = app(AgentAuthorizer::class);

    // The role alone would allow everything; the token ceiling must still hold.
    expect($authorizer->allows($super, 'places.approve', $token))->toBeTrue()
        ->and($authorizer->allows($super, 'places.delete', $token))->toBeFalse()
        ->and($authorizer->allows($super, 'transit.approve', $token))->toBeFalse()
        ->and($authorizer->allows($super, 'polls.delete', $token))->toBeFalse();
});

test('revoking a permission from the user stops the token on the next call', function () {
    $user = agentUser(['permissions' => ['places.approve']]);
    $token = agentToken($user, ['places.approve']);

    $authorizer = app(AgentAuthorizer::class);
    expect($authorizer->allows($user, 'places.approve', $token))->toBeTrue();

    // Revoke live, without touching the token.
    $user->update(['permissions' => ['places.review']]);

    expect($authorizer->allows($user, 'places.approve', $token))->toBeFalse();
});

test('a missing token denies everything', function () {
    $super = agentUser(['role' => 'superadmin']);
    $authorizer = app(AgentAuthorizer::class);

    expect($authorizer->allows($super, 'places.approve', null))->toBeFalse()
        ->and($authorizer->effectiveAbilities($super, null))->toBe([])
        ->and($authorizer->allows(null, 'places.approve', null))->toBeFalse();
});

test('effective abilities are exactly the intersection', function () {
    $user = agentUser(['permissions' => ['places.review', 'places.edit']]);
    $token = agentToken($user, ['places.review', 'places.approve']);

    $effective = app(AgentAuthorizer::class)->effectiveAbilities($user, $token);

    // places.edit: user has it, token does not  -> excluded
    // places.approve: token has it, user does not -> excluded
    expect($effective)->toBe(['places.review']);
});

test('a user holding the wildcard permission is capped by the token', function () {
    $user = agentUser(['permissions' => ['*']]);
    $token = agentToken($user, ['places.approve', 'transit.approve']);

    $effective = app(AgentAuthorizer::class)->effectiveAbilities($user, $token);

    // Ordered by the catalogue, not by the order the abilities were requested.
    expect($effective)->toBe(['transit.approve', 'places.approve']);
});

test('governorate scope is applied on top of the token ceiling', function () {
    $user = agentUser([
        'permissions' => ['transit.approve'],
        'permission_scopes' => ['transit' => ['damascus']],
    ]);

    $token = agentToken($user, ['transit.approve']);
    $authorizer = app(AgentAuthorizer::class);

    expect($authorizer->allowsInCity($user, 'transit.approve', 'damascus', $token))->toBeTrue()
        ->and($authorizer->allowsInCity($user, 'transit.approve', 'aleppo', $token))->toBeFalse()
        // fail closed: an unknown city must never widen access
        ->and($authorizer->allowsInCity($user, 'transit.approve', null, $token))->toBeFalse();
});

test('narrowing the governorate scope applies immediately', function () {
    $user = agentUser([
        'permissions' => ['transit.approve'],
        'permission_scopes' => ['transit' => ['damascus', 'aleppo']],
    ]);

    $token = agentToken($user, ['transit.approve']);
    $authorizer = app(AgentAuthorizer::class);

    expect($authorizer->allowsInCity($user, 'transit.approve', 'aleppo', $token))->toBeTrue();

    $user->update(['permission_scopes' => ['transit' => ['damascus']]]);

    expect($authorizer->allowsInCity($user, 'transit.approve', 'aleppo', $token))->toBeFalse();
});

test('non-transit capabilities ignore the transit scope', function () {
    $user = agentUser([
        'permissions' => ['places.approve'],
        'permission_scopes' => ['transit' => ['damascus']],
    ]);

    $token = agentToken($user, ['places.approve']);
    $authorizer = app(AgentAuthorizer::class);

    expect($authorizer->allowsInCity($user, 'places.approve', 'aleppo', $token))->toBeTrue();
});

test('issued tokens carry an expiry and only their hash is stored', function () {
    $user = agentUser(['permissions' => ['places.review']]);

    $issued = app(TokenIssuer::class)->issue($user, 'expiring', ['places.review'], '7d');

    $token = $issued['token']->accessToken;

    expect($token)->toBeInstanceOf(PersonalAccessToken::class)
        ->and($token->expires_at)->not->toBeNull()
        ->and((int) $token->expires_at->diffInDays(now()))->toBeLessThanOrEqual(7)
        // Sanctum stores a hash; the plaintext is not recoverable afterwards.
        ->and($token->token)->not->toBe($issued['token']->plainTextToken);
});

test('revokeAllFor removes every live token for a user', function () {
    $user = agentUser(['permissions' => ['places.review']]);

    app(TokenIssuer::class)->issue($user, 'a', ['places.review']);
    app(TokenIssuer::class)->issue($user, 'b', ['places.review']);

    expect($user->tokens()->count())->toBe(2)
        ->and(app(TokenIssuer::class)->revokeAllFor($user))->toBe(2)
        ->and($user->fresh()->tokens()->count())->toBe(0);
});

test('the catalogue is the single source of truth for capability ids', function () {
    // The Filament form and the token issuer must agree, or a superadmin could
    // grant a capability the authorizer would then reject.
    expect(PermissionCatalogue::all())
        ->toEqual(array_keys(collect(UserResource::permissionGroups())->collapse()->all()));

    expect(PermissionCatalogue::isKnown('places.approve'))->toBeTrue()
        ->and(PermissionCatalogue::isKnown('places.approv'))->toBeFalse()
        ->and(PermissionCatalogue::forModule('places'))->toHaveCount(5);
});
