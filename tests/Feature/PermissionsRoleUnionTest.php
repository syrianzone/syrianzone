<?php

use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
|--------------------------------------------------------------------------
| Phase A: materialising role grants into permissions
|--------------------------------------------------------------------------
|
| Capability resolution is about to stop reading `users.role`. That is only safe
| once every account's `permissions` already reflects the access its role gives
| it, which the 2026_07_21 backfill did not achieve: it granted `admin` 18 of
| the catalogue's 29 capabilities, and never covered the phonebook, govapps or
| users module roles at all.
|
| The tests are arranged so the load-bearing ones need no DDL. The migration
| creates a table, and MySQL commits implicitly on DDL, so invoking up() leaks
| state between tests under RefreshDatabase. Only the backup/restore contract
| genuinely needs the real thing, and it cleans up after itself.
|
*/

const BACKUP_TABLE = 'users_role_grants_backup';

function roleGrantsMigration(): object
{
    return require database_path(
        'migrations/2026_09_26_230000_materialise_role_grants_into_permissions.php'
    );
}

/**
 * What a role grants, per the migration's own hardcoded logic.
 *
 * @return array<int, string>
 */
function roleGrantsFor(?string $role): array
{
    $migration = roleGrantsMigration();

    $method = new ReflectionMethod($migration, 'grantsFor');
    $method->setAccessible(true);

    return $method->invoke($migration, $role, PermissionCatalogue::all());
}

/**
 * The exact union the migration performs, by calling into its own logic rather
 * than restating it — so a change to the migration's ordering or unknown-id
 * handling is exercised here too.
 *
 * @param  array<int, string>|null  $existing
 * @return array<int, string>
 */
function roleGrantsMerge(?array $existing, ?string $role): array
{
    $migration = roleGrantsMigration();
    $catalogue = PermissionCatalogue::all();

    $grantsFor = new ReflectionMethod($migration, 'grantsFor');
    $grantsFor->setAccessible(true);

    $ordered = new ReflectionMethod($migration, 'ordered');
    $ordered->setAccessible(true);

    return $ordered->invoke(
        $migration,
        is_array($existing) ? $existing : [],
        $grantsFor->invoke($migration, $role, $catalogue),
        $catalogue
    );
}

/**
 * @return array<int, string>
 */
function roleGrantsMigrationCatalogue(): array
{
    $source = file_get_contents(
        database_path('migrations/2026_09_26_230000_materialise_role_grants_into_permissions.php')
    );

    preg_match("/private function catalogue\(\): array\s*\{\s*return \[(.*?)\];/s", $source, $matches);
    expect(array_key_exists(1, $matches))->toBeTrue('could not find the hardcoded catalogue in the migration');

    preg_match_all("/'([a-z_]+\.[a-z_]+)'/", $matches[1], $capabilities);

    return $capabilities[1];
}

/**
 * @return array<string, string>
 */
function roleGrantsMigrationPrefixes(): array
{
    $source = file_get_contents(
        database_path('migrations/2026_09_26_230000_materialise_role_grants_into_permissions.php')
    );

    preg_match("/ROLE_MODULE_PREFIXES = \[(.*?)\];/s", $source, $matches);
    expect(array_key_exists(1, $matches))->toBeTrue('could not find the hardcoded role prefixes in the migration');

    preg_match_all("/'([a-z_]+)' => '([a-z_]+\.)'/", $matches[1], $pairs, PREG_SET_ORDER);

    return array_column($pairs, 2, 1);
}

/** The stale 18-capability list the 2026-07 backfill gave `admin`. */
function staleAdminBackfill(): array
{
    return [
        'syofficial.create', 'syofficial.edit', 'syofficial.toggle', 'syofficial.delete', 'syofficial.reorder',
        'transit.review_drafts', 'transit.approve', 'transit.reject', 'transit.edit_routes', 'transit.delete_routes',
        'places.review', 'places.approve', 'places.edit', 'places.moderate_photos', 'places.delete',
        'polls.create', 'polls.edit', 'polls.delete',
    ];
}

/*
 * RefreshDatabase migrates the in-memory SQLite database once per test process,
 * which includes this migration — so the backup table already exists by the time
 * any test here runs. Dropping it on both sides of each test makes the ones that
 * drive up()/down() directly start from a known state, instead of depending on
 * whether the bootstrap migration had already claimed the table.
 */
beforeEach(function () {
    Schema::dropIfExists(BACKUP_TABLE);
});

afterEach(function () {
    Schema::dropIfExists(BACKUP_TABLE);
});

// ─── Determinism pins ──────────────────────────────────────────────────────

it('pins the migration catalogue to PermissionCatalogue', function () {
    // The migration must not read live config, or re-running it years from now
    // would silently produce different results. The cost of that determinism is
    // a hardcoded list that can drift, and this is what makes the drift loud.
    expect(roleGrantsMigrationCatalogue())->toEqual(PermissionCatalogue::all());
});

it('pins the migration role prefixes to the ones User still resolves', function () {
    expect(roleGrantsMigrationPrefixes())->toBe([
        'syofficial_admin' => 'syofficial.',
        'transit_admin' => 'transit.',
        'govapps_admin' => 'govapps.',
        'phonebook_admin' => 'phonebook.',
        'places_admin' => 'places.',
        'users_admin' => 'users.',
    ]);
});

it('grants the whole catalogue to the catch-all admin role', function () {
    expect(roleGrantsFor('admin'))->toBe(PermissionCatalogue::all());
});

it('grants each module role exactly its own module', function () {
    foreach ([
        'syofficial_admin' => 'syofficial.',
        'transit_admin' => 'transit.',
        'govapps_admin' => 'govapps.',
        'phonebook_admin' => 'phonebook.',
        'places_admin' => 'places.',
        'users_admin' => 'users.',
    ] as $role => $prefix) {
        $expected = array_values(array_filter(
            PermissionCatalogue::all(),
            static fn (string $c) => str_starts_with($c, $prefix)
        ));

        expect(roleGrantsFor($role))->toBe($expected, "{$role} should grant only {$prefix}*");
    }
});

it('grants nothing to a plain user or a superadmin', function () {
    // A superadmin resolves the catalogue through isSuperAdmin(), so writing 29
    // rows into their array would be noise that later reads as a real grant.
    expect(roleGrantsFor('user'))->toBe([])
        ->and(roleGrantsFor('superadmin'))->toBe([])
        ->and(roleGrantsFor(null))->toBe([]);
});

// ─── The real contract: no behaviour change ────────────────────────────────

it('leaves every account\'s effective capabilities unchanged', function () {
    $cases = [
        // The shape that made this migration necessary: an admin carrying the
        // stale 18-capability list, 11 short of what its role grants.
        ['role' => 'admin', 'permissions' => staleAdminBackfill()],
        // Module roles the 2026-07 backfill never covered at all.
        ['role' => 'phonebook_admin', 'permissions' => []],
        ['role' => 'places_admin', 'permissions' => null],
        ['role' => 'govapps_admin', 'permissions' => []],
        ['role' => 'users_admin', 'permissions' => null],
        // A module role with a partial list, including a grant outside its module.
        ['role' => 'transit_admin', 'permissions' => ['transit.approve', 'places.review']],
        // Plain users, including explicit grants the union must not disturb.
        ['role' => 'user', 'permissions' => ['polls.create', 'phonebook.toggle']],
        ['role' => 'user', 'permissions' => []],
        ['role' => 'user', 'permissions' => null],
        ['role' => 'superadmin', 'permissions' => []],
        ['role' => 'superadmin', 'permissions' => ['polls.create']],
    ];

    foreach ($cases as $index => $case) {
        $user = User::factory()->create([
            'email' => "union-{$index}@example.test",
            'role' => $case['role'],
            'permissions' => $case['permissions'],
        ]);

        $before = $user->effectivePermissions();

        // What the migration would write.
        $user->permissions = roleGrantsMerge($case['permissions'], $case['role']);

        expect($user->effectivePermissions())
            ->toEqual($before, "effective capabilities would change for {$case['role']} case #{$index}");
    }
});

it('completes the stale admin backfill to the full catalogue', function () {
    $merged = roleGrantsMerge(staleAdminBackfill(), 'admin');

    expect($merged)->toHaveCount(29)
        ->toEqual(PermissionCatalogue::all());
});

it('never revokes an explicit grant, even one outside the role', function () {
    // A plain user with two hand-picked capabilities must keep both.
    $merged = roleGrantsMerge(['polls.create', 'phonebook.toggle'], 'user');

    expect($merged)->toEqual(['phonebook.toggle', 'polls.create']);
});

it('keeps a module role\'s cross-module grant, in catalogue order', function () {
    $merged = roleGrantsMerge(['transit.approve', 'places.review'], 'transit_admin');

    // The 5 transit capabilities, then the cross-module one, in catalogue order
    // — so the stored array stays comparable between accounts.
    expect($merged)->toEqual([
        'transit.review_drafts', 'transit.approve', 'transit.reject',
        'transit.edit_routes', 'transit.delete_routes',
        'places.review',
    ]);
});

it('keeps a stored capability that is not in the catalogue rather than dropping it', function () {
    // A backfill must never revoke a grant it does not understand. An id the
    // catalogue does not know about is appended rather than filtered out.
    $merged = roleGrantsMerge(['polls.create', 'legacy.thing'], 'user');

    expect($merged)->toContain('legacy.thing')
        ->and($merged)->toContain('polls.create')
        ->and(array_search('legacy.thing', $merged, true))->toBe(1);
});

it('is idempotent: merging twice changes nothing the second time', function () {
    $once = roleGrantsMerge(staleAdminBackfill(), 'admin');
    $twice = roleGrantsMerge($once, 'admin');

    expect($twice)->toEqual($once);
});

// ─── Backup, restore, and the re-run guard (these need real DDL) ───────────

it('records a restorable backup and refuses to run twice', function () {
    $stale = staleAdminBackfill();
    $user = User::factory()->create(['role' => 'admin', 'permissions' => $stale]);

    $migration = roleGrantsMigration();
    $migration->up();

    $backup = DB::table(BACKUP_TABLE)->where('user_id', $user->id)->first();

    expect($backup)->not->toBeNull()
        ->and(json_decode($backup->permissions, true))->toEqual($stale)
        ->and(json_decode($backup->permissions, true))->toHaveCount(18);

    // And the union landed.
    expect(User::find($user->id)->permissions)->toHaveCount(29);

    // A second run would re-merge role grants into accounts that may have had
    // them revoked since, silently re-granting access.
    expect(fn () => $migration->up())
        ->toThrow(RuntimeException::class, 'already exists');
});

it('restores the original permissions on rollback', function () {
    $stale = staleAdminBackfill();
    $user = User::factory()->create(['role' => 'admin', 'permissions' => $stale]);

    $migration = roleGrantsMigration();
    $migration->up();

    expect(User::find($user->id)->permissions)->toHaveCount(29);

    $migration->down();

    // Verbatim, not re-derived: the point of the backup is that rollback does
    // not depend on this migration still being correct.
    expect(User::find($user->id)->permissions)->toEqual($stale)
        ->and(Schema::hasTable(BACKUP_TABLE))->toBeFalse();
});

it('backs up soft-deleted accounts too, so a restore cannot resurrect a stale grant list', function () {
    $user = User::factory()->create(['role' => 'admin', 'permissions' => []]);
    $user->delete();

    expect($user->fresh()->trashed())->toBeTrue();

    $migration = roleGrantsMigration();
    $migration->up();

    // Soft-deleted accounts resolve no permissions today, but if one is ever
    // restored its list must already be correct.
    expect(DB::table(BACKUP_TABLE)->where('user_id', $user->id)->exists())->toBeTrue()
        ->and(DB::table('users')->where('id', $user->id)->value('permissions'))
        ->toBe(json_encode(PermissionCatalogue::all()));
});
