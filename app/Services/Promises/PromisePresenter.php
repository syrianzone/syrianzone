<?php

namespace App\Services\Promises;

use App\Models\Promise;
use App\Models\PromiseSector;
use App\Models\PromiseUpdate;
use App\Support\Governorates;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Shapes promises for the public pages and the admin.
 *
 * Countdown numbers are computed here, per request, in Syrian time, so the
 * server-rendered page and the hydrated client agree on whole days. Nothing
 * here reads vote identities: only the aggregate tally is ever exposed.
 */
class PromisePresenter
{
    public function __construct(private readonly PromiseVoteService $votes) {}

    /** Relations every public payload needs. */
    public const PUBLIC_WITH = [
        'speaker.candidate', 'speaker.officialEntity', 'speaker.houseMember',
        'institution', 'sector', 'governorateRows', 'tagRows',
    ];

    /**
     * Everything the /promises page needs. The list is small enough (hundreds,
     * not thousands) to ship whole and filter on the client, which keeps the
     * filter chips instant and the server-rendered page complete for search
     * engines.
     *
     * @return array<string, mixed>
     */
    public function index(): array
    {
        $today = Promise::today();

        $promises = Promise::published()
            ->with([...self::PUBLIC_WITH, 'updates' => fn ($q) => $q->where('type', 'progress')])
            ->get();

        $cards = $promises
            ->map(fn (Promise $p) => $this->card($p, $today))
            ->sort(fn (array $a, array $b) => $this->urgency($a) <=> $this->urgency($b))
            ->values();

        return [
            'promises' => $cards->all(),
            'stats' => $this->stats($cards),
            'filters' => [
                'sectors' => PromiseSector::active()->orderBy('order_column')->get()->map->toOption()->all(),
                'governorates' => Governorates::options(),
                'institutions' => $cards->pluck('institution')->filter()->unique('id')->sortBy('name')->values()->all(),
                'speakers' => $cards->map(fn ($c) => ['id' => $c['speaker']['id'], 'name' => $c['speaker']['name']])
                    ->unique('id')->sortBy('name')->values()->all(),
                'tags' => $cards->pluck('tags')->flatten()->unique()->sort()->values()->all(),
            ],
            'dueSoonDays' => Promise::DUE_SOON_DAYS,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function card(Promise $promise, ?CarbonImmutable $today = null): array
    {
        $today ??= Promise::today();
        $speaker = $promise->speaker;

        return [
            'id' => $promise->id,
            'number' => $promise->number,
            'title' => $promise->title,
            'speaker' => [
                'id' => $speaker?->id,
                'name' => $speaker?->name,
                'title' => $promise->speaker_title ?: $speaker?->title,
                'image' => $speaker?->resolvedImage(),
            ],
            'institution' => $promise->institution ? [
                'id' => $promise->institution->id,
                'name' => $promise->institution->name_ar ?: $promise->institution->name,
            ] : null,
            'sector' => $promise->sector?->toOption(),
            'isNational' => (bool) $promise->is_national,
            'governorates' => $promise->governorates(),
            'tags' => $promise->tags(),
            'statementDate' => $promise->statement_date?->format('Y-m-d'),
            'deadlineDate' => $promise->deadline_date?->format('Y-m-d'),
            'deadlineWording' => $promise->deadline_wording,
            'status' => $promise->status,
            'state' => $promise->displayState($today),
            'daysLeft' => $promise->daysUntilDeadline($today),
            'daysSince' => $promise->daysSinceStatement($today),
            'counter' => $promise->counter($today),
            'keptLate' => $promise->wasKeptLate(),
            'resolvedAt' => $promise->resolved_at?->format('Y-m-d'),
            'target' => $this->target($promise),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function detail(Promise $promise): array
    {
        $promise->loadMissing([...self::PUBLIC_WITH, 'sources', 'updates', 'restates', 'restatedBy']);
        $today = Promise::today();

        $related = fn (?Promise $p) => ($p && $p->review_status === 'published')
            ? ['number' => $p->number, 'title' => $p->title, 'state' => $p->displayState($today)]
            : null;

        return $this->card($promise, $today) + [
            'summary' => $promise->summary,
            'quote' => $promise->quote,
            'quoteIsVerbatim' => (bool) $promise->quote_is_verbatim,
            'statementVenue' => $promise->statement_venue,
            'deadlineReasoning' => $promise->deadline_reasoning,
            'governorateNames' => array_values(array_filter(array_map(
                fn (string $slug) => Governorates::label($slug),
                $promise->governorates(),
            ))),
            'speakerXHandle' => $promise->speaker?->resolvedXHandle(),
            'sources' => $promise->sources->map->toPayload()->all(),
            'updates' => $promise->updates->map->toPayload()->all(),
            'restates' => $related($promise->restates),
            'restatedBy' => $related($promise->restatedBy),
            'votes' => $this->votes->tally($promise),
            'votingOpen' => $promise->isOpen(),
            'publishedAt' => $promise->published_at?->toIso8601String(),
            'updatedAt' => $promise->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Scoreboard counts over a set of cards.
     *
     * @param  Collection<int, array<string, mixed>>  $cards
     * @return array<string, int>
     */
    public function stats(Collection $cards): array
    {
        $count = fn (string $state) => $cards->where('state', $state)->count();

        return [
            'total' => $cards->count(),
            'fulfilled' => $count('fulfilled'),
            'keptLate' => $cards->where('keptLate', true)->count(),
            'partiallyFulfilled' => $count('partially_fulfilled'),
            'broken' => $count('broken'),
            'overdue' => $count('overdue'),
            'open' => $count('pending') + $count('in_progress'),
            'postponed' => $count('postponed'),
            'retracted' => $count('retracted'),
        ];
    }

    /**
     * Admin list row.
     *
     * @return array<string, mixed>
     */
    public function adminRow(Promise $promise): array
    {
        return [
            'id' => $promise->id,
            'number' => $promise->number,
            'title' => $promise->title,
            'speakerName' => $promise->speaker?->name,
            'speakerPending' => $promise->speaker?->status === 'pending',
            'status' => $promise->status,
            'state' => $promise->displayState(),
            'reviewStatus' => $promise->review_status,
            'origin' => $promise->origin,
            'statementDate' => $promise->statement_date?->format('Y-m-d'),
            'deadlineDate' => $promise->deadline_date?->format('Y-m-d'),
            'sourcesCount' => (int) ($promise->sources_count ?? 0),
            'pendingReportsCount' => (int) ($promise->pending_reports_count ?? 0),
            'submitterName' => $promise->submitter?->name,
            'submitterNote' => $promise->submitter_note,
            'rejectionReason' => $promise->rejection_reason,
            'updatedAt' => $promise->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Everything the admin editor needs to edit a promise in place.
     *
     * @return array<string, mixed>
     */
    public function adminDetail(Promise $promise): array
    {
        $promise->loadMissing([
            'speaker.candidate', 'speaker.officialEntity', 'sources', 'updates',
            'governorateRows', 'tagRows', 'restates', 'submitter',
        ]);

        return [
            'id' => $promise->id,
            'number' => $promise->number,
            'title' => $promise->title,
            'summary' => $promise->summary,
            'quote' => $promise->quote,
            'quoteIsVerbatim' => (bool) $promise->quote_is_verbatim,
            'speaker' => $promise->speaker ? [
                'ref' => 'speaker:'.$promise->speaker->id,
                'name' => $promise->speaker->name,
                'title' => $promise->speaker->title,
                'image' => $promise->speaker->resolvedImage(),
                'source' => 'speaker',
                'pending' => $promise->speaker->status === 'pending',
            ] : null,
            'speakerTitle' => $promise->speaker_title,
            'institutionId' => $promise->institution_id,
            'sectorId' => $promise->sector_id,
            'isNational' => (bool) $promise->is_national,
            'governorates' => $promise->governorates(),
            'tags' => $promise->tags(),
            'statementDate' => $promise->statement_date?->format('Y-m-d'),
            'statementVenue' => $promise->statement_venue,
            'deadlineWording' => $promise->deadline_wording,
            'deadlineDate' => $promise->deadline_date?->format('Y-m-d'),
            'deadlineReasoning' => $promise->deadline_reasoning,
            'targetValue' => $promise->target_value,
            'targetUnit' => $promise->target_unit,
            'baselineValue' => $promise->baseline_value,
            'baselineNote' => $promise->baseline_note,
            'restatesPromiseId' => $promise->restates_promise_id,
            'restates' => $promise->restates ? [
                'id' => $promise->restates->id,
                'number' => $promise->restates->number,
                'title' => $promise->restates->title,
            ] : null,
            'status' => $promise->status,
            'state' => $promise->displayState(),
            'resolvedAt' => $promise->resolved_at?->format('Y-m-d'),
            'reviewStatus' => $promise->review_status,
            'publishedAt' => $promise->published_at?->toIso8601String(),
            'origin' => $promise->origin,
            'submitterName' => $promise->submitter?->name,
            'submitterNote' => $promise->submitter_note,
            'rejectionReason' => $promise->rejection_reason,
            'sources' => $promise->sources->map->toPayload()->all(),
            'updates' => $promise->updates->map->toPayload()->all(),
        ];
    }

    /**
     * Target and progress, or null when the promise has no measurable target.
     *
     * @return array<string, mixed>|null
     */
    private function target(Promise $promise): ?array
    {
        if ($promise->target_value === null) {
            return null;
        }

        /** @var PromiseUpdate|null $latest */
        $latest = $promise->updates
            ->where('type', 'progress')
            ->whereNotNull('value')
            ->sortBy([['happened_on', 'asc'], ['id', 'asc']])
            ->last();

        $current = $latest?->value;
        $baseline = $promise->baseline_value;
        $target = $promise->target_value;

        $percent = null;
        if ($current !== null) {
            $span = $target - ($baseline ?? 0);
            $percent = $span == 0.0
                ? 100
                : (int) round(max(0, min(100, (($current - ($baseline ?? 0)) / $span) * 100)));
        }

        return [
            'value' => $target,
            'unit' => $promise->target_unit,
            'baseline' => $baseline,
            'baselineNote' => $promise->baseline_note,
            'current' => $current,
            'currentOn' => $latest?->happened_on?->format('Y-m-d'),
            'percent' => $percent,
        ];
    }

    /**
     * Sort key for the default "most urgent first" order: overdue (most late
     * first), then open with a deadline (soonest first), then open count-ups
     * (oldest first), then resolved (most recent first).
     *
     * @param  array<string, mixed>  $card
     * @return array<int, int|string>
     */
    private function urgency(array $card): array
    {
        $days = $card['daysLeft'];

        return match (true) {
            $card['state'] === 'overdue' => [0, $days],
            in_array($card['state'], Promise::OPEN_STATUSES, true) && $days !== null => [1, $days],
            in_array($card['state'], Promise::OPEN_STATUSES, true) => [2, -$card['daysSince']],
            default => [3, -strtotime((string) ($card['resolvedAt'] ?? $card['statementDate']))],
        };
    }
}
