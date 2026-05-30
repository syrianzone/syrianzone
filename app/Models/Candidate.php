<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Candidate extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'poll_id', 'candidate_group_id', 'name', 'title', 'image_url', 'category', 'sort',
        'status', 'term_started_at', 'term_ended_at', 'archive_reason', 'successor_id',
    ];

    protected $casts = [
        'term_started_at' => 'date',
        'term_ended_at' => 'date',
    ];

    public function poll() { return $this->belongsTo(Poll::class); }
    public function group() { return $this->belongsTo(CandidateGroup::class, 'candidate_group_id'); }
    public function successor() { return $this->belongsTo(Candidate::class, 'successor_id'); }
}
