<?php

namespace App\Services\GovtCvs;

use App\Exceptions\GovtCvActionException;
use App\Models\GovtOfficeSlot;
use App\Models\GovtOfficial;
use App\Models\GovtTenure;
use App\Models\OfficialEntity;
use App\Services\Promises\SpeakerDirectory;
use App\Support\ArabicSearch;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Public and admin read directory for Government CVs (`السير الذاتية للمسؤولين`):
 * SQLite + MySQL compatible folded Arabic search, filters, summary statistics,
 * chronological movements feed, filter/form options, and slug lookup.
 */
final class GovtOfficialDirectory
{
    public function __construct(private readonly GovtCvPresenter $presenter) {}

    /**
     * Find a published official by slug, or throw 404 domain refusal.
     */
    public function findPublishedBySlug(string $slug): GovtOfficial
    {
        return GovtOfficial::published()
            ->with(GovtCvPresenter::PUBLIC_DETAIL_WITH)
            ->where('slug', $slug)
            ->first() ?? throw GovtCvActionException::notFound();
    }

    /**
     * Public listing with filters and summary statistics.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function index(array $filters = [], bool $includeOptions = true): array
    {
        $query = GovtOfficial::published()
            ->with(GovtCvPresenter::PUBLIC_CARD_WITH)
            ->withCount(['tenures', 'cvEntries', 'evidenceLinks']);

        $this->applyFilters($query, $filters);

        $officials = $this->sortOfficials($query->get());
        $options = $includeOptions ? $this->options() : null;

        $payload = [
            'officials' => $officials->map(fn (GovtOfficial $o) => $this->presenter->publicCard($o))->values()->all(),
            'stats' => $this->stats(),
            'institutions' => $options !== null ? $options['institutions'] : $this->institutions(),
            'filters' => $this->cleanFilters($filters),
        ];

        if ($options !== null) {
            $payload['options'] = $options;
        }

        return $payload;
    }

    /**
     * Admin listing with filters (includes drafts and archived officials).
     *
     * @param  array<string, mixed>  $filters
     * @return array<int, array<string, mixed>>
     */
    public function adminList(array $filters = []): array
    {
        $query = GovtOfficial::query()
            ->with(['tenures.institution', 'tenures.officeSlot', 'candidate', 'promiseSpeaker', 'officialEntity', 'houseMember'])
            ->withCount(['tenures', 'cvEntries', 'evidenceLinks', 'aliases']);

        if (filled($filters['publish_status'] ?? null)) {
            $query->where('publish_status', (string) $filters['publish_status']);
        }

        $this->applyFilters($query, $filters);

        $officials = $query->orderByDesc('updated_at')->orderBy('display_name_ar')->get();

        return $officials->map(fn (GovtOfficial $o) => $this->presenter->adminRow($o))->values()->all();
    }

    /**
     * Summary scoreboard statistics over all published officials and their tenures.
     *
     * @return array{total: int, in_office: int, out_of_office: int, uncertain: int, full_cv: int, total_movements: int}
     */
    public function stats(): array
    {
        $published = GovtOfficial::published()->get(['id', 'office_status', 'cv_completeness']);

        $totalMovements = GovtTenure::query()
            ->whereHas('official', fn ($q) => $q->published())
            ->count();

        return [
            'total' => $published->count(),
            'in_office' => $published->where('office_status', 'in_office')->count(),
            'out_of_office' => $published->whereIn('office_status', ['out_of_office', 'deceased'])->count(),
            'uncertain' => $published->where('office_status', 'uncertain')->count(),
            'full_cv' => $published->where('cv_completeness', 'full_cv')->count(),
            'total_movements' => $totalMovements,
        ];
    }

    /**
     * Chronological movements feed (appointments and departures/changes) across published officials.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function movements(array $filters = [], bool $includeOptions = true, bool $compact = false): array
    {
        $query = GovtTenure::query()
            ->with([
                'official.candidate',
                'official.officialEntity',
                'official.promiseSpeaker',
                'institution',
                'officeSlot',
                'evidenceLinks',
            ])
            ->whereHas('official', fn ($q) => $q->published());

        if (filled($filters['tier'] ?? null)) {
            $query->where('tier', (string) $filters['tier']);
        }

        if (filled($filters['phase'] ?? null)) {
            $query->where('government_phase', (string) $filters['phase']);
        }

        if (filled($filters['institution_id'] ?? null)) {
            $inst = (string) $filters['institution_id'];
            $query->where(function (Builder $sub) use ($inst) {
                $sub->where('institution_id', $inst)
                    ->orWhere('institution_name_ar', $inst);
            });
        }

        if (filled($filters['status'] ?? null)) {
            $statusFilter = (string) $filters['status'];
            if (in_array($statusFilter, GovtCvVocabulary::tenureStatuses(), true)) {
                $query->where('status', $statusFilter);
            } elseif (in_array($statusFilter, GovtCvVocabulary::officeStatuses(), true)) {
                $query->whereHas('official', fn ($oq) => $oq->where('office_status', $statusFilter));
            }
        }

        if (filled($filters['end_reason'] ?? null)) {
            $query->where('end_reason', (string) $filters['end_reason']);
        }

        if (filled($filters['q'] ?? null)) {
            $qRaw = trim((string) $filters['q']);
            $qFold = ArabicSearch::fold($qRaw);
            $likeFold = '%'.$this->escapeLike($qFold).'%';
            $likeRaw = '%'.$this->escapeLike($qRaw).'%';

            $query->where(function (Builder $sub) use ($likeFold, $likeRaw) {
                $sub->where('role_title_ar_fold', 'like', $likeFold)
                    ->orWhere('institution_name_ar', 'like', $likeRaw)
                    ->orWhereHas('official', function (Builder $oq) use ($likeFold, $likeRaw) {
                        $oq->where('full_name_ar_fold', 'like', $likeFold)
                            ->orWhere('display_name_ar_fold', 'like', $likeFold)
                            ->orWhere('full_name_en', 'like', $likeRaw)
                            ->orWhereHas('aliases', fn (Builder $aq) => $aq->where('alias_ar_fold', 'like', $likeFold));
                    });
            });
        }

        $tenures = $query->get();
        $lineageMap = $this->presenter->resolveSlotLineage($tenures, publishedOnly: true);

        $eventKindFilter = isset($filters['event_kind']) ? (string) $filters['event_kind'] : null;

        $events = [];
        foreach ($tenures as $tenure) {
            $lineage = $lineageMap[$tenure->id] ?? ['predecessor' => null, 'successor' => null];

            $hasStart = $tenure->started_at !== null || $tenure->first_operational_seen_at !== null;
            $hasEnd = $tenure->status === 'ended' && ($tenure->ended_at !== null || $tenure->end_reason !== null);

            if ($eventKindFilter === 'ended') {
                if ($hasEnd) {
                    $events[] = $this->presenter->movementItem($tenure, 'ended', $lineage, $compact);
                }

                continue;
            }

            if ($eventKindFilter === 'appointed') {
                if ($hasStart || ! $hasEnd) {
                    $events[] = $this->presenter->movementItem($tenure, 'appointed', $lineage, $compact);
                }

                continue;
            }

            // Default: include appointment event, and if the tenure ended, also emit the departure/change event
            $events[] = $this->presenter->movementItem($tenure, 'appointed', $lineage, $compact);
            if ($hasEnd) {
                $events[] = $this->presenter->movementItem($tenure, 'ended', $lineage, $compact);
            }
        }

        usort($events, function (array $a, array $b): int {
            $dateA = (string) ($a['event_date'] ?? $a['date'] ?? '0000-00-00');
            $dateB = (string) ($b['event_date'] ?? $b['date'] ?? '0000-00-00');
            if ($dateA !== $dateB) {
                return $dateB <=> $dateA;
            }

            $rankA = GovtCvVocabulary::tierRank($a['tier'] ?? null);
            $rankB = GovtCvVocabulary::tierRank($b['tier'] ?? null);
            if ($rankA !== $rankB) {
                return $rankA <=> $rankB;
            }

            return strcmp((string) $a['id'], (string) $b['id']);
        });

        $options = $includeOptions ? $this->options() : null;

        $payload = [
            'movements' => array_values($events),
            'stats' => $this->stats(),
            'institutions' => $options !== null ? $options['institutions'] : $this->institutions(),
            'filters' => $this->cleanFilters($filters),
        ];

        if ($options !== null) {
            $payload['options'] = $options;
        }

        return $payload;
    }

    /**
     * Institution filter/select options (non-people OfficialEntity records).
     *
     * @return array<int, array{id: string, name_ar: string, category_id: string}>
     */
    public function institutions(bool $forAdmin = false): array
    {
        return OfficialEntity::query()
            ->whereNotIn('category_id', SpeakerDirectory::PEOPLE_CATEGORIES)
            ->when(! $forAdmin, fn ($q) => $q->where('is_active', true))
            ->orderBy('category_id')
            ->orderBy('order_column')
            ->get(['id', 'name', 'name_ar', 'category_id'])
            ->map(fn (OfficialEntity $e) => [
                'id' => $e->id,
                'name_ar' => $e->name_ar ?: $e->name,
                'category_id' => $e->category_id,
            ])
            ->values()
            ->all();
    }

    /**
     * Form and filter options for both public pages and admin editor.
     *
     * @return array<string, mixed>
     */
    public function options(bool $forAdmin = false): array
    {
        $institutions = $this->institutions($forAdmin);

        $slots = GovtOfficeSlot::query()
            ->orderBy('title_ar')
            ->get(['id', 'slug', 'title_ar', 'institution_id', 'institution_name_ar', 'tier', 'is_single_seat', 'status'])
            ->map(fn (GovtOfficeSlot $s) => [
                'id' => $s->id,
                'slug' => $s->slug,
                'title_ar' => $s->title_ar,
                'institution_id' => $s->institution_id,
                'institution_name_ar' => $s->institution_name_ar,
                'tier' => $s->tier,
                'is_single_seat' => (bool) $s->is_single_seat,
                'status' => $s->status,
            ])
            ->values()
            ->all();

        return [
            'cutoff_date' => GovtCvVocabulary::cutoffDate(),
            'office_statuses' => GovtCvVocabulary::list('office_statuses'),
            'tiers' => GovtCvVocabulary::list('tiers'),
            'government_phases' => GovtCvVocabulary::list('government_phases'),
            'tenure_statuses' => GovtCvVocabulary::list('tenure_statuses'),
            'end_reasons' => GovtCvVocabulary::list('end_reasons'),
            'cv_sections' => GovtCvVocabulary::list('cv_sections'),
            'cv_completeness' => GovtCvVocabulary::list('cv_completeness'),
            'evidence_types' => GovtCvVocabulary::list('evidence_types'),
            'publish_statuses' => GovtCvVocabulary::list('publish_statuses'),
            'verification_levels' => GovtCvVocabulary::list('verification_levels'),
            'alias_types' => GovtCvVocabulary::list('alias_types'),
            'date_precisions' => GovtCvVocabulary::list('date_precisions'),
            'slot_statuses' => GovtCvVocabulary::list('slot_statuses'),
            'institutions' => $institutions,
            'office_slots' => $slots,
        ];
    }

    /**
     * Apply search and facet filters to a `GovtOfficial` query builder.
     *
     * @param  Builder<GovtOfficial>  $query
     * @param  array<string, mixed>  $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        if (filled($filters['status'] ?? null)) {
            $query->where('office_status', (string) $filters['status']);
        }

        if (filled($filters['tier'] ?? null)) {
            $tier = (string) $filters['tier'];
            $query->where(function (Builder $sub) use ($tier) {
                $sub->where('highest_tier', $tier)
                    ->orWhereHas('tenures', fn (Builder $tq) => $tq->where('tier', $tier));
            });
        }

        if (filled($filters['cv_completeness'] ?? null)) {
            $query->where('cv_completeness', (string) $filters['cv_completeness']);
        }

        if (filled($filters['institution_id'] ?? null)) {
            $inst = (string) $filters['institution_id'];
            $query->whereHas('tenures', function (Builder $tq) use ($inst) {
                $tq->where('institution_id', $inst)
                    ->orWhere('institution_name_ar', $inst);
            });
        }

        if (filled($filters['phase'] ?? null)) {
            $phase = (string) $filters['phase'];
            $query->whereHas('tenures', fn (Builder $tq) => $tq->where('government_phase', $phase));
        }

        if (filled($filters['q'] ?? null)) {
            $qRaw = trim((string) $filters['q']);
            $qFold = ArabicSearch::fold($qRaw);

            if ($qFold !== '') {
                $likeFold = '%'.$this->escapeLike($qFold).'%';
                $likeRaw = '%'.$this->escapeLike($qRaw).'%';

                $query->where(function (Builder $sub) use ($likeFold, $likeRaw) {
                    $sub->where('full_name_ar_fold', 'like', $likeFold)
                        ->orWhere('display_name_ar_fold', 'like', $likeFold)
                        ->orWhere('bio_summary_ar_fold', 'like', $likeFold)
                        ->orWhere('full_name_en', 'like', $likeRaw)
                        ->orWhereHas('aliases', fn (Builder $aq) => $aq->where('alias_ar_fold', 'like', $likeFold))
                        ->orWhereHas('tenures', function (Builder $tq) use ($likeFold, $likeRaw) {
                            $tq->where('role_title_ar_fold', 'like', $likeFold)
                                ->orWhere('institution_name_ar', 'like', $likeRaw);
                        });
                });
            }
        }
    }

    /**
     * Order officials by office status (`in_office` first), then tier seniority, then name.
     *
     * @param  Collection<int, GovtOfficial>  $officials
     * @return Collection<int, GovtOfficial>
     */
    private function sortOfficials(Collection $officials): Collection
    {
        $statusRank = [
            'in_office' => 1,
            'uncertain' => 2,
            'out_of_office' => 3,
            'deceased' => 4,
        ];

        return $officials->sort(function (GovtOfficial $a, GovtOfficial $b) use ($statusRank): int {
            $srA = $statusRank[$a->office_status] ?? 5;
            $srB = $statusRank[$b->office_status] ?? 5;
            if ($srA !== $srB) {
                return $srA <=> $srB;
            }

            $trA = GovtCvVocabulary::tierRank($a->highest_tier);
            $trB = GovtCvVocabulary::tierRank($b->highest_tier);
            if ($trA !== $trB) {
                return $trA <=> $trB;
            }

            return strcmp((string) ($a->display_name_ar ?: $a->full_name_ar), (string) ($b->display_name_ar ?: $b->full_name_ar));
        })->values();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, string|null>
     */
    private function cleanFilters(array $filters): array
    {
        $keys = ['q', 'status', 'tier', 'institution_id', 'phase', 'cv_completeness', 'end_reason', 'event_kind'];
        $out = [];
        foreach ($keys as $key) {
            $val = isset($filters[$key]) ? trim((string) $filters[$key]) : '';
            $out[$key] = $val !== '' ? $val : null;
        }

        return $out;
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $value);
    }
}
