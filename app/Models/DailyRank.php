<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DailyRank extends Model
{
    protected $primaryKey = ['poll_id', 'candidate_id', 'day'];
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['poll_id', 'candidate_id', 'day', 'rank', 'votes', 'score', 'created_at'];
    protected $casts = ['day' => 'datetime', 'created_at' => 'datetime'];
}
