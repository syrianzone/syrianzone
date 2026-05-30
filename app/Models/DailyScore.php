<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DailyScore extends Model
{
    protected $primaryKey = ['poll_id', 'candidate_id', 'day'];
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['poll_id', 'candidate_id', 'day', 'votes', 'score', 'updated_at'];
    protected $casts = ['day' => 'datetime', 'updated_at' => 'datetime'];

    protected function setKeysForSaveQuery($query)
    {
        foreach ((array) $this->getKeyName() as $key) {
            $query->where($key, '=', $this->getOriginal($key) ?? $this->getAttribute($key));
        }
        return $query;
    }
}
