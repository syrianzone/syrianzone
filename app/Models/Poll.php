<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Poll extends Model
{
    use HasFactory, HasUuids;

    /**
     * The poll behind /tierlist. Deleting or renaming this slug 404s the
     * tierlist pages, so store/update/destroy guard it explicitly.
     */
    public const CORE_POLL_SLUG = 'best-ministers';

    protected $fillable = ['slug', 'title', 'timezone', 'is_active', 'user_id'];

    // Owner id is an internal delegation key (see DashboardController account
    // deletion). It must never leak on public poll reads.
    protected $hidden = ['user_id'];

    /**
     * Timezone safe to pass to Carbon::now(). Legacy rows may hold garbage
     * (stored before the |timezone rule existed); fall back to UTC instead
     * of 500ing every read.
     */
    public function safeTimezone(): string
    {
        $tz = $this->timezone ?: 'UTC';

        return in_array($tz, timezone_identifiers_list(), true) ? $tz : 'UTC';
    }

    public function user() { return $this->belongsTo(User::class); }
    public function candidates() { return $this->hasMany(Candidate::class); }
    public function ballots() { return $this->hasMany(Ballot::class); }
    public function dailyScores() { return $this->hasMany(DailyScore::class); }
    public function groups() { return $this->hasMany(CandidateGroup::class)->orderBy('sort_order'); }
}
