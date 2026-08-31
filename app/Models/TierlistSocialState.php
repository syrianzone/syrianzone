<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class TierlistSocialState extends Model
{
    use HasUuids;

    protected $fillable = [
        'poll_id',
        'group_key',
        'observed_hash',
        'observed_snapshot',
        'observed_at',
        'published_hash',
        'published_snapshot',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'observed_snapshot' => 'array',
            'observed_at' => 'datetime',
            'published_snapshot' => 'array',
            'published_at' => 'datetime',
        ];
    }
}
