<?php

use App\Filament\Resources\UserResource;
use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;

/*
|--------------------------------------------------------------------------
| Phase G: `permissions` is the only thing that grants access
|--------------------------------------------------------------------------
|
| The final phase. `admin` was the last role that conferred access by name: it
| short-circuited User::hasPermission() to true, so the role and the access were
| the same statement. Phase A had already materialised what it granted, which is
| the only reason deleting it was possible.
|
| After this phase an account's access is exactly the capability list an
| operator ticked, and `role` holds two values: superadmin and user.
|
| These tests are mostly about the migration, because that is where the risk
| lives. The code change is four deletions; the data change is what could take
| someone's access away.
|
*/

// ─── The alias no longer exists in code ─────────────────────────────────────

it('no longer has an isAdmin method on the model', function () {
    // Stronger than asserting the behaviour: the method is gone, so nothing can
    // reintroduce a caller that depends on it.
    expect(method_exists(User::class, 'isAdmin'))->toBeFalse();
});

it('no longer resolves a bare admin role to anything', function () {
    // The role string is now inert. The migration rewrites these rows to `user`,
    // but code that still hands out the string must not create a silent
    // lockout, and code that still reads it must not create a silent grant.
    $user = User::factory()->create(['role' => 'admin', 'permissions' => []]);

    expect($user->effectivePermissions())->toBe([])
        ->and($user->isSuperAdmin())->toBeFalse();

    foreach (PermissionCatalogue::all() as $capability) {
        expect($user->hasPermission($capability))->toBeFalse();
    }
});

it('offers only superadmin and user in the role select', function () {
    expect(array_keys(UserResource::roleOptions()))
        ->toEqualCanonicalizing(['superadmin', 'user']);
});

it('has no admin middleware left', function () {
    // The class and its route alias were deleted: no route referenced it after
    // phase C moved the last group to superadmin.
    //
    // Asserted on the router's alias table rather than class_exists(), because a
    // developer's composer classmap can still list a deleted file and make
    // class_exists() fatal — a stale local artefact, not a real failure.
    $aliases = app('router')->getMiddleware();

    expect($aliases)->not->toHaveKey('admin')
        ->and(file_exists(app_path('Http/Middleware/Admin.php')))->toBeFalse();
});

// ─── The migration ─────────────────────────────────────────────────────────

/**
 * Run the phase G migration's up() over whatever is in the users table.
 *
 * The migration is an anonymous class, so it is re-required and driven directly
 * rather than through Artisan, which would need a fresh migrator state.
 */
function runRoleNormalisation(): void
{
    // The migration already ran once during RefreshDatabase, so its backup table
    // exists and up() would short-circuit. Drop it to exercise the real path —
    // which is also the only way to test it, since the skip is the point of the
    // idempotence guard.
    Schema::dropIfExists('users_role_normalisation_backup');

    $migration = require database_path('migrations/2026_09_27_100000_reduce_roles_to_superadmin_and_user.php');
    $migration->up();
}

function runRoleNormalisationDown(): void
{
    $migration = require database_path('migrations/2026_09_27_100000_reduce_roles_to_superadmin_and_user.php');
    $migration->down();

    // Leave the schema as the suite found it.
    Schema::dropIfExists('users_role_normalisation_backup');
}

it('rewrites a catch-all admin to a user holding the whole catalogue', function () {
    $admin = User::factory()->create(['role' => 'admin', 'permissions' => []]);

    runRoleNormalisation();

    $fresh = $admin->fresh();

    expect($fresh->role)->toBe('user')
        ->and($fresh->effectivePermissions())->toEqual(PermissionCatalogue::all());
});

it('rewrites a catch-all admin that carried a stale partial list', function () {
    // The realistic production shape: the 2026-07 backfill left `admin`
    // accounts 11 capabilities short of the catalogue, and it resolved the
    // difference through the short-circuit rather than in data.
    $stale = array_slice(PermissionCatalogue::all(), 0, 18);
    $admin = User::factory()->create(['role' => 'admin', 'permissions' => $stale]);

    runRoleNormalisation();

    expect($admin->fresh()->effectivePermissions())->toEqual(PermissionCatalogue::all());
});

it('rewrites module roles without touching their capabilities', function (string $module) {
    // These grant nothing since phase D, so the rewrite is cosmetic — but it is
    // what leaves the column holding two values, and it must not disturb the
    // explicit list phase A wrote.
    $staff = User::factory()->create([
        'role' => $module.'_admin',
        'permissions' => PermissionCatalogue::forModule($module),
    ]);

    $before = $staff->effectivePermissions();

    runRoleNormalisation();

    $fresh = $staff->fresh();

    expect($fresh->role)->toBe('user')
        ->and($fresh->effectivePermissions())->toEqual($before);
})->with(['syofficial', 'transit', 'govapps', 'phonebook', 'places', 'users']);

it('tops up a module role whose stored list is short', function () {
    // Defence in depth. Phase A materialised these lists, so this should not
    // occur; if it somehow does, the account should not silently lose the
    // difference.
    $staff = User::factory()->create([
        'role' => 'transit_admin',
        'permissions' => ['transit.approve'],
    ]);

    runRoleNormalisation();

    expect($staff->fresh()->effectivePermissions())
        ->toEqual(PermissionCatalogue::forModule('transit'));
});

it('leaves superadmin and plain users untouched', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin', 'permissions' => []]);
    $plain = User::factory()->create(['role' => 'user', 'permissions' => ['polls.create']]);

    runRoleNormalisation();

    expect($superadmin->fresh()->role)->toBe('superadmin')
        ->and($superadmin->fresh()->effectivePermissions())->toEqual(PermissionCatalogue::all())
        ->and($plain->fresh()->role)->toBe('user')
        ->and($plain->fresh()->effectivePermissions())->toBe(['polls.create']);
});

it('restores the original roles on rollback', function () {
    $admin = User::factory()->create(['role' => 'admin', 'permissions' => ['polls.create']]);
    $staff = User::factory()->create([
        'role' => 'places_admin',
        'permissions' => PermissionCatalogue::forModule('places'),
    ]);

    runRoleNormalisation();

    expect($admin->fresh()->role)->toBe('user')
        ->and($staff->fresh()->role)->toBe('user');

    runRoleNormalisationDown();

    // down() is a restore, not a re-derivation, so the original role and the
    // original list both come back — including the short list the admin had.
    expect($admin->fresh()->role)->toBe('admin')
        ->and($admin->fresh()->permissions)->toBe(['polls.create'])
        ->and($staff->fresh()->role)->toBe('places_admin')
        ->and($staff->fresh()->permissions)->toBe(PermissionCatalogue::forModule('places'));
});

it('skips rather than re-granting when re-run', function () {
    $admin = User::factory()->create(['role' => 'admin', 'permissions' => []]);

    runRoleNormalisation();
    expect($admin->fresh()->role)->toBe('user');

    // An operator then trims the account down. A re-run must not undo that.
    $admin->update(['permissions' => ['polls.create']]);
    runRoleNormalisation();

    expect($admin->fresh()->permissions)->toBe(['polls.create']);
});

it('leaves the role column holding only two values', function () {
    User::factory()->create(['role' => 'admin', 'permissions' => []]);
    User::factory()->create(['role' => 'transit_admin', 'permissions' => []]);
    User::factory()->create(['role' => 'places_admin', 'permissions' => []]);
    User::factory()->create(['role' => 'superadmin', 'permissions' => []]);
    User::factory()->create(['role' => 'user', 'permissions' => []]);

    runRoleNormalisation();

    expect(User::distinct()->pluck('role')->sort()->values()->all())
        ->toEqualCanonicalizing(['superadmin', 'user']);
});
