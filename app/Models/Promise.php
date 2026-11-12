<?php

namespace App\Models;

use App\Support\Facts;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * A public promise made by an official. See docs/specs/promises.md.
 *
 * `status` is the editorial verdict; `displayState()` adds the derived
 * `overdue` state, which is never stored: the site never judges a promise
 * broken on its own, an editor rules with a source.
 */
class Promise extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    /**
     * Countdowns are computed in Syrian time so "today" matches the reader.
     * The timezone is the national one from resources/data/syria.json.
     */
    public static function timezone(): string
    {
        return Facts::syria()['timezone'];
    }

    /**
     * The editorial statuses, from resources/data/promises.json.
     *
     * @return array<int, string>
     */
    public static function statuses(): array
    {
        return Facts::promiseStatuses();
    }

    /** Statuses that still await a verdict, and so can become overdue. */
    public const OPEN_STATUSES = ['pending', 'in_progress'];

    /** Verdicts that close a promise (votes freeze, `resolved_at` applies). */
    public const CLOSED_STATUSES = ['fulfilled', 'partially_fulfilled', 'broken', 'postponed', 'retracted'];

    public const VENUES = [
        'x_post', 'facebook_post', 'telegram_post', 'tv_interview', 'news_interview',
        'press_conference', 'official_statement', 'speech', 'other',
    ];

    public const REVIEW_STATUSES = ['pending', 'published', 'rejected'];

    public const ORIGINS = ['editor', 'public', 'research'];

    /** Days before a deadline that count as "due soon" on the public page. */
    public const DUE_SOON_DAYS = 30;

    /** The tracker's scope starts with the fall of the old regime. */
    public const EARLIEST_STATEMENT_DATE = '2024-12-08';

    protected $fillable = [
        'number', 'title', 'summary', 'quote', 'quote_is_verbatim',
        'speaker_id', 'speaker_title', 'institution_id', 'sector_id', 'is_national',
        'statement_date', 'statement_venue',
        'deadline_wording', 'deadline_date', 'deadline_reasoning',
        'original_deadline_date', 'original_deadline_wording', 'postponed_count',
        'target_value', 'target_unit', 'baseline_value', 'baseline_note',
        'status', 'resolved_at', 'restates_promise_id',
        'review_status', 'origin', 'submitter_note',
        'submitted_by', 'reviewed_by', 'reviewed_at', 'rejection_reason', 'published_at',
    ];

    protected $casts = [
        'number' => 'integer',
        'version' => 'integer',
        'quote_is_verbatim' => 'boolean',
        'is_national' => 'boolean',
        'statement_date' => 'date:Y-m-d',
        'deadline_date' => 'date:Y-m-d',
        'original_deadline_date' => 'date',
        'postponed_count' => 'integer',
        'resolved_at' => 'date:Y-m-d',
        'target_value' => 'float',
        'baseline_value' => 'float',
        'reviewed_at' => 'datetime',
        'published_at' => 'datetime',
    ];

    public function speaker(): BelongsTo
    {
        return $this->belongsTo(PromiseSpeaker::class, 'speaker_id');
    }

    public function coSpeakerRows(): HasMany
    {
        return $this->hasMany(PromiseCoSpeaker::class, 'promise_id')->orderBy('sort')->orderBy('id');
    }

    public function institution(): BelongsTo
    {
        return $this->belongsTo(OfficialEntity::class, 'institution_id');
    }

    public function sector(): BelongsTo
    {
        return $this->belongsTo(PromiseSector::class, 'sector_id');
    }

    public function sources(): HasMany
    {
        return $this->hasMany(PromiseSource::class)->orderByDesc('is_primary')->orderBy('sort')->orderBy('id');
    }

    public function updates(): HasMany
    {
        return $this->hasMany(PromiseUpdate::class)->orderBy('happened_on')->orderBy('id');
    }

    public function reports(): HasMany
    {
        return $this->hasMany(PromiseReport::class);
    }

    public function votes(): HasMany
    {
        return $this->hasMany(PromiseVote::class);
    }

    public function governorateRows(): HasMany
    {
        return $this->hasMany(PromiseGovernorate::class);
    }

    public function tagRows(): HasMany
    {
        return $this->hasMany(PromiseTag::class);
    }

    /** The earlier promise this one restates with a new deadline. */
    public function restates(): BelongsTo
    {
        return $this->belongsTo(Promise::class, 'restates_promise_id');
    }

    /** The published promise that restated this one, if any. */
    public function restatedBy(): HasOne
    {
        return $this->hasOne(Promise::class, 'restates_promise_id')
            ->where('review_status', 'published')
            ->latest('published_at');
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    /** @param  Builder<Promise>  $query */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('review_status', 'published')->whereNotNull('number');
    }

    /**
     * Promises waiting in the review queue: not yet published or rejected.
     *
     * @param  Builder<Promise>  $query
     */
    public function scopeInReviewQueue(Builder $query): Builder
    {
        return $query->where('review_status', 'pending');
    }

    public static function today(): CarbonImmutable
    {
        return CarbonImmutable::now(self::timezone())->startOfDay();
    }

    /** The deadline as a Syrian-time date, or null when there is no timeframe. */
    public function deadline(): ?CarbonImmutable
    {
        return $this->deadline_date
            ? CarbonImmutable::parse($this->deadline_date->format('Y-m-d'), self::timezone())->startOfDay()
            : null;
    }

    public function isOpen(): bool
    {
        return in_array($this->status, self::OPEN_STATUSES, true);
    }

    /**
     * Whole days until the deadline (0 = due today, negative = overdue), or
     * null when the promise has no deadline.
     */
    public function daysUntilDeadline(?CarbonImmutable $today = null): ?int
    {
        $deadline = $this->deadline();
        if (! $deadline) {
            return null;
        }

        return (int) ($today ?? self::today())->diffInDays($deadline, false);
    }

    /** Whole days since the statement was made. */
    public function daysSinceStatement(?CarbonImmutable $today = null): int
    {
        $made = CarbonImmutable::parse($this->statement_date->format('Y-m-d'), self::timezone())->startOfDay();

        return max(0, (int) $made->diffInDays($today ?? self::today(), false));
    }

    /** The editorial status plus the derived `overdue` state. */
    public function displayState(?CarbonImmutable $today = null): string
    {
        $days = $this->daysUntilDeadline($today);

        if ($this->isOpen() && $days !== null && $days < 0) {
            return 'overdue';
        }

        return $this->status;
    }

    /**
     * The one number a promise displays, and what it means.
     *
     * Open promises count down to the deadline (or up from the statement when
     * there is none) and keep counting once overdue. Closed promises, whatever
     * the verdict, freeze on the verdict date: how many days before or after
     * the deadline it came (`early`, `ontime`, `late`), or, with no deadline,
     * how long after the statement (`took`). A closed promise with no verdict
     * date shows its state alone (`closed`).
     *
     * @return array{mode: string, value: int|null}
     */
    public function counter(?CarbonImmutable $today = null): array
    {
        if ($this->isOpen()) {
            $days = $this->daysUntilDeadline($today);

            return match (true) {
                $days === null => ['mode' => 'since', 'value' => $this->daysSinceStatement($today)],
                $days > 0 => ['mode' => 'left', 'value' => $days],
                $days === 0 => ['mode' => 'today', 'value' => 0],
                default => ['mode' => 'overdue', 'value' => abs($days)],
            };
        }

        if ($this->resolved_at === null) {
            return ['mode' => 'closed', 'value' => null];
        }

        $resolved = CarbonImmutable::parse($this->resolved_at->format('Y-m-d'), self::timezone());
        $deadline = $this->deadline();

        if ($deadline === null) {
            $made = CarbonImmutable::parse($this->statement_date->format('Y-m-d'), self::timezone());

            return ['mode' => 'took', 'value' => max(0, (int) $made->diffInDays($resolved, false))];
        }

        $diff = (int) $deadline->diffInDays($resolved, false);

        return match (true) {
            $diff < 0 => ['mode' => 'early', 'value' => abs($diff)],
            $diff === 0 => ['mode' => 'ontime', 'value' => null],
            default => ['mode' => 'late', 'value' => $diff],
        };
    }

    /** Fulfilled, but after the deadline had passed. */
    public function wasKeptLate(): bool
    {
        return $this->status === 'fulfilled'
            && $this->deadline_date
            && $this->resolved_at
            && $this->resolved_at->format('Y-m-d') > $this->deadline_date->format('Y-m-d');
    }

    /** @return array<int, string> */
    public function governorates(): array
    {
        return $this->governorateRows->pluck('governorate')->all();
    }

    /** @return array<int, string> */
    public function tags(): array
    {
        return $this->tagRows->pluck('tag')->all();
    }

    /**
     * All UUIDs linked to this promise in promise_relations in either direction.
     *
     * @return array<int, string>
     */
    public function relatedPromiseIds(): array
    {
        $a = DB::table('promise_relations')->where('promise_id', $this->id)->pluck('related_promise_id')->all();
        $b = DB::table('promise_relations')->where('related_promise_id', $this->id)->pluck('promise_id')->all();

        return array_values(array_unique(array_merge($a, $b)));
    }

    /**
     * Published promises related to this one, ordered by statement date then number.
     *
     * @return Collection<int, Promise>
     */
    public function relatedPublishedPromises(): Collection
    {
        $ids = $this->relatedPromiseIds();
        if ($ids === []) {
            return collect();
        }

        return self::published()
            ->with('speaker')
            ->whereIn('id', $ids)
            ->orderBy('statement_date', 'asc')
            ->orderBy('number', 'asc')
            ->get();
    }
}
