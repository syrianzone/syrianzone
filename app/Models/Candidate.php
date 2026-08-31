<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Candidate extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'poll_id', 'candidate_group_id', 'name', 'title', 'x_handle', 'image_url', 'category', 'sort',
        'status', 'term_started_at', 'term_ended_at', 'archive_reason', 'successor_id',
    ];

    protected function xHandle(): Attribute
    {
        return Attribute::make(
            set: fn (?string $value) => ($value === null) ? null : (ltrim(trim($value), '@') ?: null),
        );
    }

    protected $casts = [
        'term_started_at' => 'date',
        'term_ended_at' => 'date',
    ];

    public function poll()
    {
        return $this->belongsTo(Poll::class);
    }

    public function group()
    {
        return $this->belongsTo(CandidateGroup::class, 'candidate_group_id');
    }

    public function successor()
    {
        return $this->belongsTo(Candidate::class, 'successor_id');
    }
}
