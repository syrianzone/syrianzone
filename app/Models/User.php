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

    protected $fillable = ['name', 'email', 'password', 'google_id', 'avatar_url', 'role', 'is_banned'];
    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return ['email_verified_at' => 'datetime', 'password' => 'hashed', 'is_banned' => 'boolean'];
    }

    public function isSuperAdmin(): bool { return $this->role === 'superadmin'; }

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
