<?php

namespace App\Models;

use App\Support\Permissions\PermissionCatalogue;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements FilamentUser
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = ['name', 'email', 'password', 'google_id', 'avatar_url', 'role', 'permissions', 'permission_scopes', 'settings', 'is_banned'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_banned' => 'boolean',
            'permissions' => 'array',
            'permission_scopes' => 'array',
            'settings' => 'array',
        ];
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === 'superadmin';
    }

    /**
     * Roles that imply a whole module's capabilities, as role => module prefix.
     *
     * Table-driven so hasPermission() and effectivePermissions() cannot drift:
     * they are the same rule applied to one id and to the whole catalogue. The
     * prefix must match a module key in PermissionCatalogue.
     *
     * @var array<string, string>
     */
    protected const ROLE_MODULE_PREFIXES = [
        'syofficial_admin' => 'syofficial.',
        'transit_admin' => 'transit.',
        'govapps_admin' => 'govapps.',
        'phonebook_admin' => 'phonebook.',
        'places_admin' => 'places.',
    ];

    /**
     * The role => module-prefix table, for callers that need to enumerate it
     * (the Filament role select, dev impersonation, tests).
     *
     * @return array<string, string>
     */
    public static function moduleImplyingRoles(): array
    {
        return self::ROLE_MODULE_PREFIXES;
    }

    /**
     * The broad administrator: every capability.
     *
     * `admin` is the catch-all staff role that AdminUserController mints and
     * that the 2026_07_21 permissions backfill migration granted the full
     * capability set to. PollsAdmin/PlacesAdmin/PhonebookAdmin and the plain
     * `admin` middleware all treat it as a blanket override, so hasPermission()
     * must agree — otherwise a freshly created admin is silently denied by
     * syofficial_admin, GovAppsAdmin and transit_admin, which have no
     * role === 'admin' shortcut of their own.
     */
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->isSuperAdmin() || $this->isAdmin()) {
            return true;
        }

        $prefix = self::ROLE_MODULE_PREFIXES[$this->role] ?? null;

        if ($prefix !== null && str_starts_with($permission, $prefix)) {
            return true;
        }

        $userPerms = $this->permissions ?? [];

        return in_array($permission, $userPerms) || in_array('*', $userPerms);
    }

    /**
     * Every capability this user can exercise, role implications resolved.
     *
     * Shared with the frontend so the browser never has to re-derive which
     * capabilities a role implies — that duplication is what let the TS mirror
     * fall behind the PHP rules. A user with the `*` wildcard is reported as
     * holding the whole catalogue, which is what the wildcard means.
     *
     * @return array<int, string>
     */
    public function effectivePermissions(): array
    {
        $catalogue = PermissionCatalogue::all();

        if ($this->isSuperAdmin() || $this->isAdmin() || in_array('*', $this->permissions ?? [], true)) {
            return $catalogue;
        }

        $prefix = self::ROLE_MODULE_PREFIXES[$this->role] ?? null;

        $granted = $this->permissions ?? [];

        return array_values(array_filter(
            $catalogue,
            fn (string $permission) => ($prefix !== null && str_starts_with($permission, $prefix))
                || in_array($permission, $granted, true),
        ));
    }

    public function hasAnyPermission(array $permissions): bool
    {
        foreach ($permissions as $perm) {
            if ($this->hasPermission($perm)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Governorate (transit city) scope for this user's transit capabilities.
     *
     * Returns null when the user is unrestricted (superadmin, no scope stored,
     * or an empty scope list). A non-null array limits every transit.* action
     * to those city ids. Scopes are stored per module so other modules can
     * adopt the same pattern later:
     *   {"transit": ["damascus", "aleppo"]}
     *
     * @return array<int, string>|null
     */
    public function allowedTransitCities(): ?array
    {
        if ($this->isSuperAdmin()) {
            return null;
        }

        $scopes = $this->permission_scopes['transit'] ?? null;

        if (! is_array($scopes) || $scopes === []) {
            return null;
        }

        $cities = array_values(array_unique(array_filter(
            array_map(fn ($city) => is_string($city) ? trim($city) : '', $scopes),
            fn (string $city) => $city !== '',
        )));

        return $cities === [] ? null : $cities;
    }

    public function isTransitScopeRestricted(): bool
    {
        return $this->allowedTransitCities() !== null;
    }

    /**
     * Capability check with governorate scoping for transit.* permissions.
     *
     * Non-transit capabilities ignore the scope. When the user is scoped and
     * the city is unknown, the check fails closed so a missing/renamed city
     * never widens access.
     */
    public function hasPermissionInCity(string $permission, ?string $cityId): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        if (! $this->hasPermission($permission)) {
            return false;
        }

        if (! str_starts_with($permission, 'transit.')) {
            return true;
        }

        $allowed = $this->allowedTransitCities();

        if ($allowed === null) {
            return true;
        }

        return $cityId !== null && in_array($cityId, $allowed, true);
    }

    /**
     * @param  array<int, string>  $permissions
     */
    public function hasAnyPermissionInCity(array $permissions, ?string $cityId): bool
    {
        foreach ($permissions as $permission) {
            if ($this->hasPermissionInCity($permission, $cityId)) {
                return true;
            }
        }

        return false;
    }

    public function canAccessPanel(Panel $panel): bool
    {
        return $this->isSuperAdmin() && ! $this->is_banned;
    }

    public function polls()
    {
        return $this->hasMany(Poll::class);
    }

    public function routes()
    {
        return $this->hasMany(Route::class);
    }

    public function routeDrafts()
    {
        return $this->hasMany(RouteDraft::class);
    }
}
