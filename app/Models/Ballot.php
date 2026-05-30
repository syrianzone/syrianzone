<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Ballot extends Model
{
    use HasUuids;

    protected $fillable = ['poll_id', 'vote_day', 'voter_key', 'ip_hash', 'user_agent'];
    protected $casts = ['vote_day' => 'datetime'];

    public function poll() { return $this->belongsTo(Poll::class); }
    public function items() { return $this->hasMany(BallotItem::class); }
}
