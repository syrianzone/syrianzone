<?php

use App\Support\Permissions\PermissionCatalogue;

/*
|--------------------------------------------------------------------------
| Pins for the deployed role-grant backfill migration
|--------------------------------------------------------------------------
|
| The 2026-09-26 migration materialised what each account's role granted into
| its own `permissions` array, which is what made it safe to stop reading the
| role. It is deployed, applied everywhere, and refuses to re-apply.
|
| So the behaviour it implemented is history: the twelve tests that once walked
| through its grant logic, its idempotence, its backup and its rollback recorded
| decisions that have since shipped and cannot be exercised against production
| data. They are gone, and the git history keeps them.
|
| What remains is the one property that is still live. The migration hardcodes
| its capability list and its role prefixes rather than reading config, because
| a migration must produce the same result every time it runs — including years
| from now, and including on a database that is being rebuilt from scratch. The
| cost of that determinism is a hardcoded list that can drift from the live
| catalogue, and these two tests are what make the drift loud instead of silent.
|
*/

/**
 * The capability list the migration hardcodes, scraped from its source.
 *
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
 * The role => module-prefix table the migration hardcodes.
 *
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

it('pins the migration catalogue to PermissionCatalogue', function () {
    expect(roleGrantsMigrationCatalogue())->toEqual(PermissionCatalogue::all());
});

it('pins the migration role prefixes to the ones it was written against', function () {
    // These prefixes no longer resolve anywhere — the model table they mirror was
    // deleted. The list is kept because the migration that used it is still on
    // disk and still runnable on a fresh database, and a reader comparing the two
    // needs to see that they were identical when the migration was written.
    expect(roleGrantsMigrationPrefixes())->toBe([
        'syofficial_admin' => 'syofficial.',
        'transit_admin' => 'transit.',
        'govapps_admin' => 'govapps.',
        'phonebook_admin' => 'phonebook.',
        'places_admin' => 'places.',
        'users_admin' => 'users.',
    ]);
});
