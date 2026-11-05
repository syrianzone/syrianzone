<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CandidateGroup extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = ['poll_id', 'name', 'key', 'sort_order', 'is_default', 'is_active'];

    protected $casts = ['is_default' => 'boolean', 'is_active' => 'boolean'];

    public function poll()
    {
        return $this->belongsTo(Poll::class);
    }

    public function candidates()
    {
        return $this->hasMany(Candidate::class);
    }

    /**
     * Categories a guest may see and vote in. A disabled category keeps its
     * row, its candidates and its scores; it just drops out of every public
     * read (tierlist tabs, leaderboard rankings, X snapshots).
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeDisabled(Builder $query): Builder
    {
        return $query->where('is_active', false);
    }

    public function isActive(): bool
    {
        return (bool) $this->is_active;
    }
}
