<?php

namespace App\Models;

use App\Support\Facts;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Poll extends Model
{
    use HasFactory, HasUuids;

    /**
     * The poll behind /tierlist. Deleting or renaming this slug 404s the
     * tierlist pages, so store/update/destroy guard it explicitly. The slug is
     * a shared fact (resources/data/polls.json) because the dashboard and the
     * tier-list page compare against it in TypeScript too.
     */
    public static function coreSlug(): string
    {
        return Facts::polls()['core_slug'];
    }

    /** The timezone a new poll starts with; the editor never exposes it. */
    public static function defaultTimezone(): string
    {
        return Facts::polls()['default_timezone'];
    }

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

    /**
     * Resolve a poll from a route segment that may be either its id or its
     * slug. Every public poll endpoint accepts both; this is the one place that
     * says how.
     *
     * @param  \Illuminate\Database\Eloquent\Builder<Poll>  $query
     */
    public function scopeIdOrSlug($query, string $idOrSlug)
    {
        return $query->where(fn ($q) => $q->where('id', $idOrSlug)->orWhere('slug', $idOrSlug));
    }

    public function user() { return $this->belongsTo(User::class); }
    public function candidates() { return $this->hasMany(Candidate::class); }
    public function ballots() { return $this->hasMany(Ballot::class); }
    public function dailyScores() { return $this->hasMany(DailyScore::class); }
    public function groups() { return $this->hasMany(CandidateGroup::class)->orderBy('sort_order'); }
}
