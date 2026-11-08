<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A "will it be kept?" vote. `voter_key` and `ip_hash` are HMACs and must
 * never be selected by a public read; only aggregates leave the server.
 */
class PromiseVote extends Model
{
    protected $fillable = ['promise_id', 'voter_key', 'ip_hash', 'believes'];

    protected $hidden = ['voter_key', 'ip_hash'];

    protected $casts = [
        'believes' => 'boolean',
    ];
}
