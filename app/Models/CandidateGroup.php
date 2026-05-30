<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CandidateGroup extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = ['poll_id', 'name', 'key', 'sort_order', 'is_default'];
    protected $casts = ['is_default' => 'boolean'];

    public function poll() { return $this->belongsTo(Poll::class); }
    public function candidates() { return $this->hasMany(Candidate::class); }
}
