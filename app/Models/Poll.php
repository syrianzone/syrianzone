<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Poll extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = ['slug', 'title', 'timezone', 'is_active'];

    public function candidates() { return $this->hasMany(Candidate::class); }
    public function ballots() { return $this->hasMany(Ballot::class); }
    public function groups() { return $this->hasMany(CandidateGroup::class)->orderBy('sort_order'); }
}
