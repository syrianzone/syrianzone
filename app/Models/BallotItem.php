<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class BallotItem extends Model
{
    use HasUuids;

    public $timestamps = false;
    protected $fillable = ['ballot_id', 'candidate_id', 'tier', 'position'];

    public function ballot() { return $this->belongsTo(Ballot::class); }
    public function candidate() { return $this->belongsTo(Candidate::class); }
}
