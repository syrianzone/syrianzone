<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Phase A of moving from roles to capabilities: materialise what each account's
 * role grants today into its own `permissions` array.
 *
 * WHY
 *
 * Capability resolution is about to stop consulting the role. That is only safe
 * once every account's `permissions` already reflects the access its role gives
 * it, and two gaps make that untrue today:
 *
 *  1. The 2026_07_21 backfill granted `admin` 18 of the catalogue's 29
 *     capabilities — it predates govapps.*, phonebook.* and users.ban, so those
 *     admin accounts are 11 short of what their role actually gives them.
 *  2. That same backfill only knew about `admin`, `syofficial_admin` and
 *     `transit_admin`. Accounts holding phonebook_admin, places_admin,
 *     govapps_admin or users_admin were never given an array at all, so when
 *     role prefixes stop resolving they are left with nothing.
 *
 * This migration closes both by UNIONING each account's role grants into its
 * existing list. Union, never replace: an explicit grant is never revoked, and
 * an account that already held more than its role implies keeps the extra.
 *
 * The result is that effectivePermissions() returns exactly the same list before
 * and after — asserted by PermissionsRoleUnionTest, which snapshots both sides.
 * This phase changes no access whatsoever; it only makes the existing access
 * explicit, so that later phases can stop reading the role.
 *
 * DETERMINISM
 *
 * The role -> capability mapping is hardcoded rather than read from
 * User::ROLE_MODULE_PREFIXES or PermissionCatalogue. A migration must produce
 * the same result every time it runs, including years from now; reading live
 * config would silently change history if the catalogue grows. The cost is a
 * hardcoded list that can drift, so PermissionsRoleUnionTest pins it against
 * PermissionCatalogue and fails when the catalogue moves without this file
 * being updated deliberately.
 *
 * ROLLBACK
 *
 * Every touched row's original role and permissions are copied to
 * users_role_grants_backup first, so down() is a restore rather than a
 * re-derivation. The migration refuses to run if that table already exists,
 * which stops it being re-applied over restored data and quietly re-granting
 * capabilities to accounts that had them revoked in the meantime.
 */
return new class extends Migration
{
    private const BACKUP_TABLE = 'users_role_grants_backup';

    /**
     * Role values that grant a whole module, and the module prefix. Mirrors
     * User::ROLE_MODULE_PREFIXES, which Phase D removes.
     *
     * @var array<string, string>
     */
    private const ROLE_MODULE_PREFIXES = [
        'syofficial_admin' => 'syofficial.',
        'transit_admin' => 'transit.',
        'govapps_admin' => 'govapps.',
        'phonebook_admin' => 'phonebook.',
        'places_admin' => 'places.',
        'users_admin' => 'users.',
    ];

    /**
     * `admin` is the catch-all staff role: User::hasPermission() short-circuits
     * to true for it, so it is granted the entire catalogue.
     */
    private const CATCH_ALL_ROLES = ['admin'];

    public function up(): void
    {
        if (Schema::hasTable(self::BACKUP_TABLE)) {
            throw new RuntimeException(sprintf(
                'Table "%s" already exists, so this migration has already run. '
                .'Refusing to re-apply: role grants would be re-merged into accounts '
                .'that may have had those capabilities revoked since. Restore from the '
                .'backup and drop the table first if you really need to re-run it.',
                self::BACKUP_TABLE
            ));
        }

        $catalogue = $this->catalogue();
        $users = User::withTrashed()->get(['id', 'email', 'role', 'permissions']);

        $backup = [];
        $updates = [];
        $log = [];

        foreach ($users as $user) {
            $existing = is_array($user->permissions) ? $user->permissions : [];
            $grants = $this->grantsFor($user->role, $catalogue);

            // Superadmins resolve the whole catalogue through isSuperAdmin(), so
            // writing 29 rows into their array would be noise that later reads as
            // a deliberate grant.
            if ($grants === []) {
                continue;
            }

            // Backed up even when nothing changes, so a rollback restores the
            // exact prior state rather than a partially rewritten one.
            $backup[] = [
                'id' => $user->id,
                'email' => $user->email,
                'role' => $user->role,
                'permissions' => json_encode($user->permissions),
                'backed_up_at' => now(),
            ];

            $merged = $this->ordered($existing, $grants, $catalogue);

            if ($merged === $existing) {
                continue;
            }

            $updates[] = ['id' => $user->id, 'permissions' => json_encode($merged)];
            $log[] = sprintf(
                '  #%d %s role=%s: %d -> %d capabilities',
                $user->id,
                $user->email,
                (string) $user->role,
                count($existing),
                count($merged)
            );
        }

        Schema::create(self::BACKUP_TABLE, function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();
            $table->string('email')->nullable();
            $table->string('role')->nullable();
            $table->json('permissions')->nullable();
            $table->timestamp('backed_up_at');
        });

        foreach ($backup as $row) {
            DB::table(self::BACKUP_TABLE)->insert([
                'user_id' => $row['id'],
                'email' => $row['email'],
                'role' => $row['role'],
                'permissions' => $row['permissions'],
                'backed_up_at' => $row['backed_up_at'],
            ]);
        }

        foreach ($updates as $row) {
            DB::table('users')->where('id', $row['id'])->update(['permissions' => $row['permissions']]);
        }

        // The point of the log: this is the only record of what changed, and it
        // is what makes the migration auditable after the fact.
        info(sprintf(
            'users: materialised role grants into permissions — backed up %d row(s), updated %d.',
            count($backup),
            count($updates)
        ));

        if ($log !== []) {
            info("users: role-grant union detail\n".implode("\n", $log));
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::BACKUP_TABLE)) {
            // Nothing was recorded, so nothing was changed.
            return;
        }

        DB::table(self::BACKUP_TABLE)->orderBy('id')->each(function ($row) {
            DB::table('users')->where('id', $row->user_id)->update([
                'permissions' => $row->permissions,
            ]);
        });

        Schema::drop(self::BACKUP_TABLE);
    }

    /**
     * The full capability catalogue, as it stands at this migration.
     *
     * @return array<int, string>
     */
    private function catalogue(): array
    {
        return [
            'syofficial.create', 'syofficial.edit', 'syofficial.toggle', 'syofficial.delete', 'syofficial.reorder',
            'govapps.create', 'govapps.edit', 'govapps.toggle', 'govapps.delete', 'govapps.reorder',
            'transit.review_drafts', 'transit.approve', 'transit.reject', 'transit.edit_routes', 'transit.delete_routes',
            'places.review', 'places.approve', 'places.edit', 'places.moderate_photos', 'places.delete',
            'phonebook.create', 'phonebook.edit', 'phonebook.toggle', 'phonebook.delete', 'phonebook.reorder',
            'polls.create', 'polls.edit', 'polls.delete',
            'compass.stats',
            'users.ban',
        ];
    }

    /**
     * Union two capability lists, in catalogue order.
     *
     * Ordering by the catalogue rather than by arrival keeps the stored array
     * canonical, so two accounts holding the same capabilities serialise
     * identically and a diff of this column stays readable. Access is a set, so
     * this is cosmetic — but it is the kind of cosmetic that stops being
     * cosmetic the first time someone compares two rows by eye.
     *
     * Anything in the stored list that is NOT in the catalogue is kept, and
     * appended. Silently dropping it would revoke a grant this migration does
     * not understand, which is the one thing a backfill must never do.
     *
     * @param  array<int, string>  $existing
     * @param  array<int, string>  $grants
     * @param  array<int, string>  $catalogue
     * @return array<int, string>
     */
    private function ordered(array $existing, array $grants, array $catalogue): array
    {
        $held = array_flip(array_merge($existing, $grants));

        $known = array_values(array_filter(
            $catalogue,
            static fn (string $capability) => isset($held[$capability])
        ));

        $unknown = array_values(array_filter(
            array_keys($held),
            static fn (string $capability) => ! in_array($capability, $catalogue, true)
        ));

        return array_merge($known, $unknown);
    }

    /**
     * What a role grants at this migration. Empty means "nothing to materialise":
     * either a plain `user`, or a superadmin who bypasses the array entirely.
     *
     * @param  array<int, string>  $catalogue
     * @return array<int, string>
     */
    private function grantsFor(?string $role, array $catalogue): array
    {
        if ($role === null) {
            return [];
        }

        if (in_array($role, self::CATCH_ALL_ROLES, true)) {
            return $catalogue;
        }

        $prefix = self::ROLE_MODULE_PREFIXES[$role] ?? null;

        if ($prefix === null) {
            return [];
        }

        return array_values(array_filter(
            $catalogue,
            static fn (string $capability) => str_starts_with($capability, $prefix)
        ));
    }
};
