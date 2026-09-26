<?php

use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;

/*
|--------------------------------------------------------------------------
| Phase D: the role no longer confers anything
|--------------------------------------------------------------------------
|
| Phase A made existing access explicit. Phase B stopped the codebase minting
| new role-derived access. Phase C moved the remaining readers of `role` onto
| the capability list. This phase deletes the mechanism itself:
| User::ROLE_MODULE_PREFIXES and User::moduleImplyingRoles().
|
| After this, `permissions` is the only thing that grants access, apart from two
| named roles: superadmin, and the deprecated `admin` alias. The six module
| roles — syofficial_admin, transit_admin, govapps_admin, phonebook_admin,
| places_admin, users_admin — are inert strings.
|
| The point of the file is the negative direction. Phases A to C each proved
| something was still granted; this proves nothing is, so a stray role can never
| quietly become a back door.
|
*/

// ─── The six module roles confer nothing ────────────────────────────────────

/**
 * The historical role => module prefix map. Hardcoded because the model no
 * longer carries it, and a test that read the table it is meant to police would
 * be circular. A test elsewhere pins this against PermissionCatalogue.
 *
 * @return array<string, string>
 */
function phaseDModuleRoles(): array
{
    return [
        'syofficial_admin' => 'syofficial.',
        'transit_admin' => 'transit.',
        'govapps_admin' => 'govapps.',
        'phonebook_admin' => 'phonebook.',
        'places_admin' => 'places.',
        'users_admin' => 'users.',
    ];
}

it('grants a module role nothing at all', function (string $role) {
    $user = User::factory()->create(['role' => $role, 'permissions' => []]);

    expect($user->effectivePermissions())->toBe([])
        // Not even the module it is named after.
        ->and($user->isAdmin())->toBeFalse()
        ->and($user->isSuperAdmin())->toBeFalse();

    foreach (PermissionCatalogue::all() as $capability) {
        expect($user->hasPermission($capability))->toBeFalse();
    }
})->with(phaseDModuleRoles());

it('removes the module role prefix table from the model', function () {
    // The strongest form of the claim: the mechanism is gone, not merely
    // bypassed. A future edit that reintroduces it fails here.
    expect(method_exists(User::class, 'moduleImplyingRoles'))->toBeFalse();

    $reflection = new ReflectionClass(User::class);

    expect($reflection->hasConstant('ROLE_MODULE_PREFIXES'))->toBeFalse();
});

it('keeps an explicit grant working under a module role name', function () {
    // The Phase A and Phase D safety net in one assertion: an account still
    // labelled transit_admin keeps working, but because its capabilities were
    // materialised — not because of the name.
    $user = User::factory()->create([
        'role' => 'transit_admin',
        'permissions' => PermissionCatalogue::forModule('transit'),
    ]);

    expect($user->effectivePermissions())->toHaveCount(5)
        ->and($user->hasPermission('transit.approve'))->toBeTrue()
        // and the role name contributes nothing beyond what is stored
        ->and($user->hasPermission('transit.delete_routes'))
        ->toBe(in_array('transit.delete_routes', $user->permissions, true));
});

it('resolves access for a plain user purely from the stored array', function () {
    $user = User::factory()->create([
        'role' => 'user',
        'permissions' => ['polls.create'],
    ]);

    expect($user->hasPermission('polls.create'))->toBeTrue()
        // holding one polls capability must not imply the rest of its module
        ->and($user->hasPermission('polls.delete'))->toBeFalse()
        ->and($user->effectivePermissions())->toBe(['polls.create']);
});

it('still resolves the deprecated admin alias to the whole catalogue', function () {
    // Phase G removes this. Until then it must keep working, or every account
    // still carrying it loses access in one step.
    $user = User::factory()->create(['role' => 'admin', 'permissions' => []]);

    expect($user->effectivePermissions())->toEqual(PermissionCatalogue::all())
        ->and($user->hasPermission('transit.approve'))->toBeTrue();
});

it('still resolves superadmin to the whole catalogue', function () {
    $user = User::factory()->create(['role' => 'superadmin', 'permissions' => []]);

    expect($user->effectivePermissions())->toEqual(PermissionCatalogue::all());
});

it('honours the wildcard for an ordinary role', function () {
    // `*` predates the migration and is the one non-role grant that survives it.
    $user = User::factory()->create(['role' => 'user', 'permissions' => ['*']]);

    expect($user->effectivePermissions())->toEqual(PermissionCatalogue::all())
        ->and($user->hasPermission('govapps.delete'))->toBeTrue();
});

it('does not let an unset role grant anything', function () {
    // users.role is NOT NULL, so a persisted account cannot have a null role.
    // The reachable case is an unsaved model — a form being validated, a factory
    // mid-build — where the attribute has never been set. That is exactly the
    // state that used to index ROLE_MODULE_PREFIXES with null, a PHP 8.1
    // deprecation that `?? null` does not suppress. With the table gone there is
    // nothing left to index, but the resolution must still be well defined.
    $unsaved = new User(['permissions' => ['polls.create']]);

    expect($unsaved->role)->toBeNull()
        ->and($unsaved->hasPermission('polls.create'))->toBeTrue()
        ->and($unsaved->hasPermission('polls.delete'))->toBeFalse()
        ->and($unsaved->effectivePermissions())->toBe(['polls.create'])
        ->and($unsaved->isAdmin())->toBeFalse()
        ->and($unsaved->isSuperAdmin())->toBeFalse();
});

it('refuses a module role at the admin API, which mints capability-backed users', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);

    $this->actingAs($superadmin)
        ->postJson('/api/admins', [
            'name' => 'Transit Operator',
            'email' => 'transit-operator@example.test',
            'role' => 'transit_admin',
        ])
        ->assertCreated()
        ->assertJsonPath('role', 'user');

    $created = User::where('email', 'transit-operator@example.test')->firstOrFail();

    // The requested role is discarded, and access comes from the catalogue.
    expect($created->role)->toBe('user')
        ->and($created->effectivePermissions())->toEqual(PermissionCatalogue::all());
});
