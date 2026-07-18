<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MediaCleanupJob extends Model
{
    protected $fillable = [
        'available_at',
        'claim_token',
        'claimed_at',
        'disk',
        'is_directory',
        'path',
    ];

    protected function casts(): array
    {
        return [
            'available_at' => 'datetime',
            'attempts' => 'integer',
            'claimed_at' => 'datetime',
            'is_directory' => 'boolean',
        ];
    }
}
