<?php

use App\Filament\Resources\UserResource;
use App\Http\Middleware\AutoLoginDevUser;
use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Support\Facades\Schema;

/*
|--------------------------------------------------------------------------
| Phase B: stop granting access by role
|--------------------------------------------------------------------------
|
| Phase A made existing access explicit. Phase B stops the codebase producing
| new role-derived access, so later phases can remove the role machinery
| without anything new depending on it:
|
|  - AdminUserController mints a plain `user` with an explicit capability list
|    rather than `role => 'admin'`, which short-circuited every check.
|  - The `role` column default is `user`, so an omitted role cannot mint an
|    all-powerful account.
|  - The six module roles are no longer assignable.
|  - Dev impersonation presets are capability-backed `user` accounts, not roles,
|    so they keep working once ROLE_MODULE_PREFIXES is gone.
|
| Nothing here changes anyone's current access. That is the contract for the
| whole phase.
|
*/

it('defaults an omitted role to user, which holds nothing', function () {
    // Defence in depth. All three account-creation paths set `role` explicitly,
    // so this only decides what happens when a future one forgets: fail closed.
    $user = new User(['name' => 'No Role', 'email' => 'norole@example.test']);
    $user->password = bcrypt('secret');
    $user->save();

    $fresh = $user->fresh();

    expect($fresh->role)->toBe('user')
        ->and($fresh->effectivePermissions())->toBe([])
        // Explicitly not the `admin` wildcard.
        ->and($fresh->isAdmin())->toBeFalse();

    $user->forceDelete();
});

it('stores the column default as user, not admin', function () {
    $driver = Schema::getConnection()->getDriverName();

    if ($driver === 'mysql' || $driver === 'mariadb') {
        $column = Schema::select("SHOW COLUMNS FROM users LIKE 'role'");
        $default = is_array($column) ? ($column[0]->Default ?? null) : null;
    } else {
        // SQLite rebuilds the table on change(). pragma_table_info is a
        // table-valued function, so it needs a raw SELECT rather than a query
        // builder `from` clause.
        $default = DB::selectOne(
            "SELECT dflt_value FROM pragma_table_info('users') WHERE name = 'role'"
        )->dflt_value ?? null;
    }

    expect(trim((string) $default, "'\" "))->toBe('user');
});

it('creates a staff account as a user with the full catalogue', function () {
    $this->actingAs(User::factory()->create(['role' => 'superadmin']))
        ->postJson('/api/admins', ['name' => 'Staff', 'email' => 'staff@example.test'])
        ->assertCreated()
        ->assertJsonPath('role', 'user');

    $created = User::where('email', 'staff@example.test')->firstOrFail();

    expect($created->permissions)->toEqual(PermissionCatalogue::all())
        ->and($created->effectivePermissions())->toEqual(PermissionCatalogue::all());
});

it('gives a minted account the same access the old admin role did', function () {
    // Parity check, stated directly: every capability the deprecated role
    // resolved must be one the new account also resolves.
    $viaRole = User::factory()->create(['role' => 'admin', 'permissions' => []]);

    $this->actingAs(User::factory()->create(['role' => 'superadmin']))
        ->postJson('/api/admins', ['name' => 'Parity', 'email' => 'parity@example.test']);

    $minted = User::where('email', 'parity@example.test')->firstOrFail();

    expect($minted->effectivePermissions())->toEqual($viaRole->effectivePermissions());
});

it('no longer offers the six module roles in the user form', function () {
    $offered = array_keys(UserResource::roleOptions());

    expect($offered)->toEqualCanonicalizing(['superadmin', 'admin', 'user']);
});

it('still offers the deprecated admin alias', function () {
    // Deliberate: it still resolves the whole catalogue through
    // User::isAdmin(), and Phase G removes it once nothing depends on it.
    expect(array_keys(UserResource::roleOptions()))->toContain('admin');
});

it('backs every dev preset with explicit capabilities, not a role', function () {
    $middleware = new AutoLoginDevUser;

    foreach (AutoLoginDevUser::DEV_ROLES as $preset) {
        $user = $middleware->ensureDevUser($preset);

        // The preset name is not the account's role any more, so dev
        // impersonation keeps working after ROLE_MODULE_PREFIXES is removed.
        // The `user` preset is the one whose name coincides with its role.
        expect($user->role)->toBe($preset === 'superadmin' ? 'superadmin' : 'user');

        if (str_ends_with($preset, '_admin') && $preset !== 'superadmin') {
            expect($user->role)->not->toBe($preset);
        }
    }
});

it('gives a module dev preset exactly that module', function () {
    $middleware = new AutoLoginDevUser;

    $cases = [
        'transit_admin' => 'transit.',
        'syofficial_admin' => 'syofficial.',
        'govapps_admin' => 'govapps.',
        'phonebook_admin' => 'phonebook.',
        'places_admin' => 'places.',
        'users_admin' => 'users.',
    ];

    foreach ($cases as $preset => $prefix) {
        $user = $middleware->ensureDevUser($preset);

        $expected = array_values(array_filter(
            PermissionCatalogue::all(),
            static fn (string $c) => str_starts_with($c, $prefix)
        ));

        expect($user->effectivePermissions())->toEqual($expected, "{$preset} should hold {$prefix}*");
    }
});

it('gives the plain user dev preset nothing', function () {
    $user = (new AutoLoginDevUser)->ensureDevUser('user');

    expect($user->effectivePermissions())->toBe([]);
});

it('syncs a dev account that predates the capability backing', function () {
    $middleware = new AutoLoginDevUser;

    // An account created back when the preset really was a role: it holds the
    // stale role and whatever the 2026-07 backfill gave it.
    $spec = AutoLoginDevUser::DEV_USERS['transit_admin'];
    $legacy = User::create([
        'name' => $spec['name'],
        'email' => $spec['email'],
        'password' => bcrypt('password'),
        'role' => 'transit_admin',
        'permissions' => ['transit.approve'],
    ]);

    $user = $middleware->ensureDevUser('transit_admin');

    expect($user->is($legacy))->toBeTrue()
        ->and($user->role)->toBe('user')
        ->and($user->effectivePermissions())->toHaveCount(5);
});

it('re-syncs a dev account whose capabilities were edited', function () {
    $middleware = new AutoLoginDevUser;
    $user = $middleware->ensureDevUser('places_admin');

    $user->update(['permissions' => []]);

    expect($middleware->ensureDevUser('places_admin')->effectivePermissions())->toHaveCount(5);
});
