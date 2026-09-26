<?php

use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Phase D safety net: give any account still leaning on a module role its
 * capabilities explicitly, one last time, before the role prefixes are removed.
 *
 * WHY THIS EXISTS
 *
 * Phase A materialised role grants into `permissions`, and Phase B stopped the
 * Filament role select offering the six module roles. Between those two deploys
 * there was a window in which the select still offered `transit_admin` and the
 * form still saved it. An account created in that window carries a module role
 * and whatever capabilities the operator happened to tick — possibly none.
 *
 * Phase A cannot help such an account: it had already run, and it refuses to
 * re-apply. So when Phase D removes User::ROLE_MODULE_PREFIXES, that account
 * resolves nothing and its owner is locked out of the module they were hired
 * for. This migration closes the window.
 *
 * It unions the module's capabilities into any account that would otherwise lose
 * them, and touches nothing else. An account whose `permissions` already cover
 * the module is left completely alone, so this is a no-op on a database that has
 * had no activity since Phase A.
 *
 * DETERMINISM
 *
 * The role -> module mapping is hardcoded rather than read from
 * User::ROLE_MODULE_PREFIXES, which this phase deletes. A migration must produce
 * the same result every time it runs; reading live config would rewrite history
 * if the catalogue grows. PhaseDRolePrefixesRemovedTest pins the list against
 * PermissionCatalogue so drift fails loudly instead of silently.
 *
 * IDEMPOTENCE
 *
 * Unlike Phase A this migration does NOT throw when its backup table already
 * exists — it skips. It is a safety net, and a safety net that re-grants
 * capabilities on every re-run would undo a deliberate revocation. Skipping is
 * the safe direction to be wrong in: an account that still needs repair was
 * missed once and can be repaired by hand, whereas a re-grant is invisible.
 */
return new class extends Migration
{
    private const BACKUP_TABLE = 'users_role_prefix_cleanup_backup';

    /**
     * Role values that grant a whole module, and the module prefix. Mirrors the
     * User::ROLE_MODULE_PREFIXES that this phase removes.
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

    public function up(): void
    {
        if (Schema::hasTable(self::BACKUP_TABLE)) {
            // Already applied. Re-granting here would resurrect capabilities an
            // operator has since revoked, so skipping is the safe direction.
            return;
        }

        $catalogue = PermissionCatalogue::all();

        $repaired = [];

        foreach (DB::table('users')->get(['id', 'role', 'permissions']) as $row) {
            $prefix = self::ROLE_MODULE_PREFIXES[$row->role] ?? null;

            if ($prefix === null) {
                continue;
            }

            $stored = $this->decode($row->permissions);
            $module = array_values(array_filter(
                $catalogue,
                static fn (string $capability) => str_starts_with($capability, $prefix)
            ));

            // Already fully covered, or a wildcard that already covers everything.
            if ($module === [] || in_array('*', $stored, true) || array_diff($module, $stored) === []) {
                continue;
            }

            $repaired[] = [
                'user_id' => $row->id,
                'role' => $row->role,
                'permissions' => $stored,
                'granted' => array_values(array_unique(array_merge($stored, $module))),
            ];
        }

        if ($repaired === []) {
            // Nothing to do. Still create the table so a re-run stays a no-op for
            // the same reason a second application would be.
            $this->createBackupTable();

            return;
        }

        $this->createBackupTable();

        foreach ($repaired as $row) {
            DB::table(self::BACKUP_TABLE)->insert([
                'user_id' => $row['user_id'],
                'role' => $row['role'],
                'permissions' => json_encode($row['permissions'], JSON_THROW_ON_ERROR),
            ]);

            DB::table('users')
                ->where('id', $row['user_id'])
                ->update(['permissions' => json_encode($row['granted'], JSON_THROW_ON_ERROR)]);
        }

        Log::info(sprintf(
            'Phase D: granted explicit capabilities to %d account(s) still holding a module role.',
            count($repaired)
        ));
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::BACKUP_TABLE)) {
            return;
        }

        DB::table(self::BACKUP_TABLE)->orderBy('user_id')->each(function ($row): void {
            DB::table('users')->where('id', $row->user_id)->update([
                'permissions' => $row->permissions,
            ]);
        });

        Schema::drop(self::BACKUP_TABLE);
    }

    private function createBackupTable(): void
    {
        Schema::create(self::BACKUP_TABLE, function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('role');
            $table->text('permissions')->nullable();
            $table->timestamps();
        });
    }

    /**
     * @return array<int, string>
     */
    private function decode(?string $permissions): array
    {
        if ($permissions === null || $permissions === '') {
            return [];
        }

        $decoded = json_decode($permissions, true);

        return is_array($decoded) ? array_values(array_filter($decoded, 'is_string')) : [];
    }
};
