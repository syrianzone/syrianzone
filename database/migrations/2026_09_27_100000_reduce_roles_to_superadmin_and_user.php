<?php

use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Phase G, final step: leave `permissions` as the only thing that grants access,
 * and `role` holding only two values.
 *
 * WHY
 *
 * `admin` was a catch-all: User::hasPermission() short-circuited to true for
 * it, so the role and the access were the same statement. It is a deprecated
 * alias now only because phase A had to materialise what it granted before the
 * short-circuit could be deleted. With that done, removing it completes the
 * migration: an account's access is exactly the capability list an operator
 * ticked.
 *
 * After phases A to D, two kinds of role string were still in the column:
 *
 *  - `admin`, which resolved the entire catalogue through a short-circuit in
 *    hasPermission(). A code path, not a stored list.
 *  - the six module roles, left over from before phase D. These grant nothing at
 *    all now — phase A gave them explicit capabilities and phase D deleted the
 *    prefix table — so they are inert labels on accounts that are already
 *    correct.
 *
 * Both are rewritten to 'user', which leaves the column holding exactly
 * 'superadmin' and 'user'. For `admin` the full catalogue is unioned in first,
 * so the rewrite cannot lose access; for the module roles that union is a no-op
 * in practice, and is applied only where the stored list does not already cover
 * the module the role used to imply.
 *
 * superadmin is left alone. It short-circuits on isSuperAdmin(), it owns the
 * Filament panel, and nothing in this series touches it. It is also the only
 * role value anything still queries by name.
 *
 * IDEMPOTENCE
 *
 * Skips when its backup table already exists rather than throwing, for the same
 * reason as the phase D safety net: a re-run must not re-grant capabilities an
 * operator has since revoked, and a rewrite of role -> 'user' is not something
 * to perform twice over rows that may since have been promoted.
 */
return new class extends Migration
{
    private const BACKUP_TABLE = 'users_role_normalisation_backup';

    private const REPLACEMENT = 'user';

    /**
     * Every role value that no longer grants anything, and so can be rewritten
     * to `user` without touching access.
     *
     * `admin` is the catch-all that short-circuited every permission check. The
     * six module roles stopped conferring capabilities in phase D, once phase A
     * had materialised what each of them granted.
     *
     * @var array<int, string>
     */
    private const RETIRED_ROLES = [
        'admin',
        'syofficial_admin',
        'transit_admin',
        'govapps_admin',
        'phonebook_admin',
        'places_admin',
        'users_admin',
    ];

    /**
     * Module prefix per retired module role, so an account whose stored list is
     * somehow short of its old module still gets topped up rather than silently
     * losing the difference. Mirrors the table phase D deleted.
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
            return;
        }

        $catalogue = PermissionCatalogue::all();

        $rows = DB::table('users')->whereIn('role', self::RETIRED_ROLES)->get(['id', 'role', 'permissions']);

        Schema::create(self::BACKUP_TABLE, function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('role');
            $table->text('permissions')->nullable();
            $table->timestamps();
        });

        foreach ($rows as $row) {
            $stored = $this->decode($row->permissions);

            $granted = match (true) {
                // The catch-all resolved everything, so it must end up holding
                // everything.
                $row->role === 'admin' => $catalogue,
                // A module role's capabilities were materialised in phase A. Top
                // up only if the stored list is short, which should not happen.
                isset(self::ROLE_MODULE_PREFIXES[$row->role]) => array_values(array_unique(array_merge(
                    $stored,
                    array_values(array_filter(
                        $catalogue,
                        static fn (string $c) => str_starts_with($c, self::ROLE_MODULE_PREFIXES[$row->role])
                    ))
                ))),
                default => $stored,
            };

            DB::table(self::BACKUP_TABLE)->insert([
                'user_id' => $row->id,
                'role' => $row->role,
                'permissions' => json_encode($stored, JSON_THROW_ON_ERROR),
            ]);

            DB::table('users')->where('id', $row->id)->update([
                'permissions' => json_encode($granted, JSON_THROW_ON_ERROR),
                'role' => self::REPLACEMENT,
            ]);
        }

        Log::info(sprintf(
            'Phase G: rewrote role to `%s` on %d account(s) holding a retired role value.',
            self::REPLACEMENT,
            $rows->count()
        ));
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::BACKUP_TABLE)) {
            return;
        }

        DB::table(self::BACKUP_TABLE)->orderBy('user_id')->each(function ($row): void {
            DB::table('users')->where('id', $row->user_id)->update([
                'role' => $row->role,
                'permissions' => $row->permissions,
            ]);
        });

        Schema::drop(self::BACKUP_TABLE);
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
