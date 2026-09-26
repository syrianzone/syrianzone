<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Dev-only identity switching.
 *
 * A "dev role" here is a PRESET, not a `users.role` value. The presets used to
 * double as real roles, which meant dev impersonation only worked while the
 * module roles still resolved capabilities through User::ROLE_MODULE_PREFIXES.
 * Phase D removed that table, so decoupling them here is what keeps the dev
 * switcher working at all.
 *
 * So each preset is now a plain `user` account carrying an explicit capability
 * list, named after the module it previews. The switcher UI is unchanged: it
 * still lists presets, and `/dev/impersonate/{preset}` still accepts them.
 */
class AutoLoginDevUser
{
    /**
     * Preset names the switcher offers. Mirrored by ROLE_META in
     * resources/js/Components/DevRoleSwitcher.tsx.
     */
    public const DEV_ROLES = [
        'user', 'transit_admin', 'syofficial_admin', 'govapps_admin',
        'phonebook_admin', 'places_admin', 'users_admin', 'admin', 'superadmin',
    ];

    /**
     * Per preset: the account, and the capabilities it holds. A module preset
     * holds exactly its module, so it previews that panel's real access rather
     * than a role string that happens to unlock it.
     *
     * @var array<string, array{name: string, email: string, permissions: array<int, string>}>
     */
    public const DEV_USERS = [
        'user' => [
            'name' => 'Dev User',
            'email' => 'dev-user@syrian.zone',
            'permissions' => [],
        ],
        'transit_admin' => [
            'name' => 'Dev Transit Admin',
            'email' => 'dev-transit@syrian.zone',
            'permissions' => ['module:transit'],
        ],
        'syofficial_admin' => [
            'name' => 'Dev SyOfficial Admin',
            'email' => 'dev-syofficial@syrian.zone',
            'permissions' => ['module:syofficial'],
        ],
        'govapps_admin' => [
            'name' => 'Dev Gov Apps Admin',
            'email' => 'dev-govapps@syrian.zone',
            'permissions' => ['module:govapps'],
        ],
        'phonebook_admin' => [
            'name' => 'Dev Phonebook Admin',
            'email' => 'dev-phonebook@syrian.zone',
            'permissions' => ['module:phonebook'],
        ],
        'places_admin' => [
            'name' => 'Dev Places Admin',
            'email' => 'dev-places@syrian.zone',
            'permissions' => ['module:places'],
        ],
        'users_admin' => [
            'name' => 'Dev Users Admin',
            'email' => 'dev-users@syrian.zone',
            'permissions' => ['module:users'],
        ],
        'admin' => [
            'name' => 'Dev Admin',
            'email' => 'dev-admin@syrian.zone',
            // The whole catalogue explicitly, so this preset keeps previewing
            // "staff with everything" after the `admin` alias is retired.
            'permissions' => ['catalogue'],
        ],
        'superadmin' => [
            'name' => 'Dev Superadmin',
            'email' => 'dev-superadmin@syrian.zone',
            'permissions' => ['catalogue'],
        ],
    ];

    public static function isDevMode(): bool
    {
        return config('app.env') !== 'production' && env('AUTO_LOGIN_DEV', false) === true;
    }

    public function handle(Request $request, Closure $next)
    {
        if (! self::isDevMode()) {
            return $next($request);
        }

        // The impersonation route sets the dev_role cookie itself; let it run.
        if ($request->route()?->named('dev.impersonate')) {
            return $next($request);
        }

        $role = $this->resolveRole($request);
        $user = $this->ensureDevUser($role);

        // Always enforce the chosen preset as the active identity. The preset
        // name is deliberately not compared against the account's role, because
        // every preset is now a `user`; the email is what distinguishes them.
        if (! Auth::check() || Auth::user()->email !== $user->email) {
            Auth::login($user, true);
        }

        return $next($request);
    }

    public function resolveRole(Request $request): string
    {
        // Prefer the session choice (set by DevController); fall back to the
        // dev_role cookie. Both are written together on impersonation.
        $role = null;
        try {
            if ($request->hasSession() && $request->session()->isStarted()) {
                $role = $request->session()->get('dev_role');
            }
        } catch (\Throwable $e) {
            $role = null;
        }
        if (! $role) {
            $role = $request->cookie('dev_role');
        }

        return in_array($role, self::DEV_ROLES) ? $role : 'superadmin';
    }

    public function ensureDevUser(string $preset): User
    {
        $preset = in_array($preset, self::DEV_ROLES) ? $preset : 'superadmin';
        $spec = self::DEV_USERS[$preset];
        $permissions = $this->resolvePermissions($spec['permissions']);

        $user = User::firstOrCreate(
            ['email' => $spec['email']],
            [
                'name' => $spec['name'],
                'google_id' => 'dev-'.$preset,
                'avatar_url' => 'https://github.com/identicons/'.$preset.'.png',
                'password' => bcrypt('password'),
                'role' => $preset === 'superadmin' ? 'superadmin' : 'user',
                'permissions' => $permissions,
            ]
        );

        // firstOrCreate only inserts, so an account that predates this change
        // would keep the old role and whatever the July backfill gave it. Sync
        // on every hit: the preset is the source of truth, and this is
        // dev-only code so re-applying is free.
        if ($user->permissions !== $permissions || ($preset === 'superadmin') !== $user->isSuperAdmin()) {
            $user->forceFill([
                'permissions' => $permissions,
                'role' => $preset === 'superadmin' ? 'superadmin' : 'user',
            ])->save();
        }

        return $user;
    }

    /**
     * Expand the shorthand in DEV_USERS against the live catalogue.
     *
     * @param  array<int, string>  $spec
     * @return array<int, string>
     */
    private function resolvePermissions(array $spec): array
    {
        $catalogue = PermissionCatalogue::all();

        $resolved = [];

        foreach ($spec as $entry) {
            if ($entry === 'catalogue') {
                return $catalogue;
            }

            if (str_starts_with($entry, 'module:')) {
                $prefix = substr($entry, strlen('module:')).'.';

                foreach ($catalogue as $capability) {
                    if (str_starts_with($capability, $prefix)) {
                        $resolved[] = $capability;
                    }
                }

                continue;
            }

            $resolved[] = $entry;
        }

        return array_values(array_unique($resolved));
    }
}
