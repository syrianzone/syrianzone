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

    protected $fillable = ['name', 'email', 'password', 'google_id', 'avatar_url', 'role', 'permissions', 'is_banned'];
    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_banned' => 'boolean',
            'permissions' => 'array',
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
