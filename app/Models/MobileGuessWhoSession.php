<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class MobileGuessWhoSession extends Model
{
    use HasUuids;

    protected $fillable = [
        'credential_hash',
        'expires_at',
        'generation',
        'last_used_at',
        'role',
        'room_code',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'generation' => 'integer',
            'last_used_at' => 'datetime',
        ];
    }
}
