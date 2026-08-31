<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class TierlistSocialPost extends Model
{
    use HasUuids;

    protected $fillable = [
        'poll_id',
        'group_key',
        'transition_hash',
        'before_hash',
        'after_hash',
        'before_snapshot',
        'after_snapshot',
        'text',
        'status',
        'attempts',
        'last_http_status',
        'last_error',
        'x_post_id',
        'attempted_at',
        'posted_at',
    ];

    protected function casts(): array
    {
        return [
            'before_snapshot' => 'array',
            'after_snapshot' => 'array',
            'attempted_at' => 'datetime',
            'posted_at' => 'datetime',
        ];
    }
}
