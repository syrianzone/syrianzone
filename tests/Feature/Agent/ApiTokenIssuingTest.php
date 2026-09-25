<?php

use App\Filament\Resources\ApiTokenResource;
use App\Support\Agents\ApiTokenIssuer;
use App\Support\Agents\InvalidTokenAbilities;
use App\Support\Agents\TokenIssuer;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Validation\ValidationException;

/*
|--------------------------------------------------------------------------
| Token issuance from the panel form
|--------------------------------------------------------------------------
|
| The Filament form is the only way a token comes into existence, so its
| shape-handling is security-relevant: the grouped checkboxes are the only
| thing standing between a superadmin's intent and the ability list.
|
*/

test('grouped checkbox state is flattened into an ability list', function () {
    $form = [
        'tokenable_id' => 1,
        'name' => 'claude',
        'ttl' => '30d',
        'perm_places' => ['places.review', 'places.approve'],
        'perm_transit' => ['transit.approve'],
        'perm_polls' => [],
        'unrelated' => 'ignored',
    ];

    expect(app(ApiTokenIssuer::class)->collectAbilities($form))
        ->toBe(['places.review', 'places.approve', 'transit.approve']);
});

test('a form issues a token clamped to what the owner holds', function () {
    $user = agentUser(['permissions' => ['places.review']]);

    $issued = app(ApiTokenIssuer::class)->issueFromFormData([
        'tokenable_id' => $user->id,
        'name' => 'claude-code',
        'ttl' => '30d',
        'perm_places' => ['places.review', 'places.delete'],
    ]);

    expect($issued['abilities'])->toBe(['places.review'])
        ->and($issued['dropped'])->toBe(['places.delete'])
        ->and($issued['token']->plainTextToken)->not->toBeEmpty()
        ->and($issued['owner']->id)->toBe($user->id);
});

test('a token cannot be issued for a banned user', function () {
    $user = agentUser(['permissions' => ['places.review'], 'is_banned' => true]);

    expect(fn () => app(ApiTokenIssuer::class)->issueFromFormData([
        'tokenable_id' => $user->id,
        'name' => 'x',
        'perm_places' => ['places.review'],
    ]))->toThrow(ValidationException::class);
});

test('a token cannot be issued for an unknown user', function () {
    expect(fn () => app(ApiTokenIssuer::class)->issueFromFormData([
        'tokenable_id' => 999999,
        'name' => 'x',
    ]))->toThrow(ValidationException::class);
});

test('a token needs a name', function () {
    $user = agentUser(['permissions' => ['places.review']]);

    expect(fn () => app(ApiTokenIssuer::class)->issueFromFormData([
        'tokenable_id' => $user->id,
        'name' => '   ',
        'perm_places' => ['places.review'],
    ]))->toThrow(ValidationException::class);
});

test('a wildcard smuggled through the form is refused', function () {
    $super = agentUser(['role' => 'superadmin']);

    expect(fn () => app(ApiTokenIssuer::class)->issueFromFormData([
        'tokenable_id' => $super->id,
        'name' => 'god',
        // Not reachable through the rendered checkboxes, but the service must
        // not depend on the UI being the only caller.
        'perm_places' => ['*'],
    ]))->toThrow(InvalidTokenAbilities::class);
});

test('duplicate and whitespace-padded abilities are normalised', function () {
    $super = agentUser(['role' => 'superadmin']);

    $issued = app(TokenIssuer::class)->issue($super, 'dupes', [
        ' places.approve ',
        'places.approve',
        '',
        'places.edit',
    ]);

    expect($issued['abilities'])->toBe(['places.approve', 'places.edit']);
});

test('an unknown ttl falls back to the default rather than minting forever', function () {
    $user = agentUser(['permissions' => ['places.review']]);

    $issued = app(TokenIssuer::class)->issue($user, 'weird-ttl', ['places.review'], '9999y');

    $expires = $issued['token']->accessToken->expires_at;

    expect((int) $expires->diffInDays(now()))->toBeLessThanOrEqual(TokenIssuer::TTL_OPTIONS[TokenIssuer::DEFAULT_TTL]);
});

test('the eligible-owner list excludes users holding no capability', function () {
    $plain = agentUser(['role' => 'user', 'permissions' => []]);
    // An empty (not null) permissions array must not qualify anyone.
    $emptyJson = agentUser(['role' => 'user', 'permissions' => []]);
    $granted = agentUser(['role' => 'user', 'permissions' => ['places.review']]);
    $staff = agentUser(['role' => 'transit_admin']);

    $ids = ApiTokenResource::eligibleOwners()->pluck('id');

    expect($ids)->toContain($staff->id)
        ->and($ids)->toContain($granted->id)
        ->and($ids)->not->toContain($plain->id)
        ->and($ids)->not->toContain($emptyJson->id);
});

test('the token ttl options are the ones the issuer understands', function () {
    expect(array_keys(ApiTokenResource::ttlOptions()))
        ->toBe(array_keys(TokenIssuer::TTL_OPTIONS))
        ->and(ApiTokenResource::ttlOptions())->toHaveCount(4);
});

test('every catalogue capability can be granted to a superadmin token', function () {
    $super = agentUser(['role' => 'superadmin']);

    $issued = app(TokenIssuer::class)->issue($super, 'everything', PermissionCatalogue::all());

    expect($issued['dropped'])->toBe([])
        ->and($issued['abilities'])->toHaveCount(count(PermissionCatalogue::all()));
});
