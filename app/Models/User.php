<?php

namespace App\Models;

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

    protected $fillable = [
        'avatar_disk',
        'avatar_path',
        'avatar_url',
        'email',
        'google_id',
        'is_banned',
        'name',
        'password',
        'permissions',
        'role',
        'settings',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_banned' => 'boolean',
            'permissions' => 'array',
            'settings' => 'array',
        ];
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === 'superadmin';
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        if ($this->role === 'admin' && in_array(strtok($permission, '.'), [
            'govapps',
            'phonebook',
            'places',
            'polls',
            'syofficial',
            'transit',
        ], true)) {
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

        return in_array($permission, $userPerms, true) || in_array('*', $userPerms, true);
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
