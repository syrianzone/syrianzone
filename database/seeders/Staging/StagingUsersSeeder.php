<?php

namespace Database\Seeders\Staging;

use App\Models\User;
use Illuminate\Support\Collection;

/**
 * The staging cast. Every other staging module hangs its rows off these users,
 * so this one runs first.
 *
 * All accounts live on @staging.syrian.zone, which is not a real mail domain:
 * that keeps them trivially greppable and impossible to confuse with a real
 * signup. Password for every account is in docs/staging_guide.md.
 *
 * The last two accounts are deliberately broken states (banned, soft-deleted).
 * The guides leaderboard and the admin lists both filter on them, and that
 * filtering is exactly the kind of thing that silently regresses.
 *
 * A filter fixture is only worth having if removing the filter changes the
 * answer. So these two accounts are NOT empty: StagingPlacesSeeder gives each of
 * them nine approved places saved by every live user, which is more approved
 * places and more saves than any real guide has. If PlaceDiscoveryController::
 * guides ever loses its `whereNull(users.deleted_at)` or `is_banned = false`
 * clause, a banned account takes rank 1 in every sort and you see it instantly.
 * That is the whole point; keep them stocked.
 *
 * guides() therefore returns only the live cast (the other modules attach their
 * rows to it and must not pick up a broken account), and excluded() returns the
 * two broken ones for the places seeder to stock.
 */
class StagingUsersSeeder extends StagingSeed
{
    public const DOMAIN = '@staging.syrian.zone';

    /** Same password for every staging account. Documented, not secret. */
    public const PASSWORD = 'staging';

    /** [handle, display name, role, banned, soft-deleted] */
    public const CAST = [
        ['owner', 'ليلى الحلبي', 'superadmin', false, false],
        ['admin', 'سامر الدمشقي', 'admin', false, false],
        ['transit', 'رامي الحمصي', 'transit_admin', false, false],
        ['guide-nour', 'نور العلي', 'user', false, false],
        ['guide-kareem', 'كريم الشامي', 'user', false, false],
        ['guide-hala', 'هالة اللاذقاني', 'user', false, false],
        ['guide-omar', 'عمر الفرات', 'user', false, false],
        ['guide-sana', 'سناء التدمري', 'user', false, false],
        ['visitor', 'زائر تجريبي', 'user', false, false],
        ['banned', 'حساب محظور', 'user', true, false],
        ['deleted', 'حساب محذوف', 'user', false, true],
    ];

    public function run(): void
    {
        $this->seedRandom('staging-users');

        foreach (self::CAST as $i => [$handle, $name, $role, $banned, $softDeleted]) {
            $user = User::withTrashed()->updateOrCreate(
                ['email' => $handle.self::DOMAIN],
                [
                    'name' => $name,
                    'role' => $role,
                    'is_banned' => $banned,
                    'password' => self::PASSWORD,
                    'google_id' => 'staging-'.$handle,
                    // dicebear renders deterministically from the seed and needs no api key,
                    // so avatars survive an offline staging box without 404ing the ui.
                    'avatar_url' => 'https://api.dicebear.com/7.x/thumbs/svg?seed='.$handle,
                ]
            );

            // `php artisan db:seed` wraps the whole run in Model::unguarded(), so
            // $fillable is not enforced here and these would in fact mass-assign fine.
            // forceFill is kept anyway so the seeder does not depend on being called
            // through that command: it lands the same either way. saveQuietly skips
            // the model events, which is what we want for backdated fixture rows.
            $user->forceFill([
                'email_verified_at' => $verifiedAt = $this->pastDate(400, 200),
                'created_at' => $verifiedAt,
                'deleted_at' => $softDeleted ? $this->pastDate(30, 5) : null,
            ])->saveQuietly();

            $this->command?->getOutput()->writeln(
                sprintf('  <fg=gray>user</> %-28s %s', $user->email, $role.($banned ? ' (banned)' : '').($softDeleted ? ' (deleted)' : ''))
            );
        }
    }

    /** Live (not banned, not deleted) staging users, for the other modules to attach rows to. */
    public static function guides(): Collection
    {
        return User::where('email', 'like', '%'.self::DOMAIN)
            ->where('is_banned', false)
            ->orderBy('id')
            ->get();
    }

    /**
     * The two deliberately broken accounts (banned, soft-deleted).
     *
     * The complement of guides() over the staging cast, and the only caller is
     * StagingPlacesSeeder, which stocks them so the exclusion filters have
     * something to exclude. Do not attach ordinary demo rows to these: anything
     * hung here is meant to be invisible on every public surface.
     */
    public static function excluded(): Collection
    {
        return User::withTrashed()
            ->where('email', 'like', '%'.self::DOMAIN)
            ->where(fn ($q) => $q->where('is_banned', true)->orWhereNotNull('deleted_at'))
            ->orderBy('id')
            ->get();
    }
}
