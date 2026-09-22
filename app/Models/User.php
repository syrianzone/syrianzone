<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

use Illuminate\Database\Eloquent\SoftDeletes;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;

class User extends Authenticatable implements FilamentUser
{
    use HasFactory, Notifiable, SoftDeletes;

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

    public function isSuperAdmin(): bool { return $this->role === 'superadmin'; }

    public function hasPermission(string $permission): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        if ($this->role === 'syofficial_admin' && str_starts_with($permission, 'syofficial.')) {
            return true;
        }
        if ($this->role === 'transit_admin' && str_starts_with($permission, 'transit.')) {
            return true;
        }
        if ($this->role === 'govapps_admin' && str_starts_with($permission, 'govapps.')) {
            return true;
        }
        if ($this->role === 'phonebook_admin' && str_starts_with($permission, 'phonebook.')) {
            return true;
        }

        $userPerms = $this->permissions ?? [];
        return in_array($permission, $userPerms) || in_array('*', $userPerms);
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
     * @param array<int, string> $permissions
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
        return $this->isSuperAdmin() && !$this->is_banned;
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
