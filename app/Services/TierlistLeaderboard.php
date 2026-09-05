<?php

namespace App\Services;

use App\Models\Poll;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class TierlistLeaderboard
{
    /**
     * Canonical status vocabulary, shared by the legacy leaderboard
     * (/api/polls/{slug}/leaderboard) and the public API
     * (/api/v1/polls/{id}/candidates): active | former | all.
     * 'archived' (the candidates.status DB value) is accepted as an alias
     * of 'former' and normalized to it.
     */
    public const STATUSES = ['active', 'former', 'all'];

    public const DB_ALIAS = 'archived';

    public static function normalizeStatus(string $status): string
    {
        return $status === self::DB_ALIAS ? 'former' : $status;
    }

    public function build(Poll $poll, string $status = 'active'): array
    {
        $status = self::normalizeStatus($status);
        if (! in_array($status, self::STATUSES, true)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'status' => 'Invalid status. Expected one of: active, former, all (archived is accepted as an alias of former).',
            ]);
        }
        $groups = $poll->groups()->get();
        $candidatesQuery = $poll->candidates()->orderBy('sort');

        if ($status === 'active') {
            $candidatesQuery->where('status', 'active');
        } elseif ($status === 'former') {
            $candidatesQuery->where('status', 'archived');
        }

        $candidates = $candidatesQuery->get()->keyBy('id');
        $scores = $this->scores($poll, $candidates);
        $rankings = [
            'ministers' => [],
            'governors' => [],
            'security' => [],
            'jolani' => [],
        ];

        foreach ($groups as $group) {
            $key = $this->normalizeGroupKey($group->key ?? $group->id);
            $rankings[$key] = $scores
                ->filter(fn (array $item) => $item['groupId'] === $group->id)
                ->values()
                ->map(fn (array $item, int $index) => [...$item, 'rank' => $index + 1])
                ->all();
        }

        return compact('groups', 'candidates', 'rankings', 'status');
    }

    // Only these tierlists are announced. The satirical jolani group and any
    // admin-created group without a key (its snapshot key would fall back to
    // the 36-char group UUID and overflow the group_key column) stay out.
    private const ANNOUNCED_GROUPS = ['ministers', 'governors', 'security'];

    // One snapshot per group: each tierlist is watched, settled, and announced
    // independently. The hash covers only the ordered candidate IDs (FR-002).
    public function snapshot(Poll $poll): array
    {
        $leaderboard = $this->build($poll);
        $groups = $leaderboard['groups']->map(function ($group) use ($leaderboard) {
            $key = $this->normalizeGroupKey($group->key ?? $group->id);
            $candidates = collect($leaderboard['rankings'][$key] ?? [])
                ->map(fn (array $candidate) => [
                    'id' => $candidate['candidateId'],
                    'name' => $candidate['name'],
                    'title' => $candidate['title'] ?? null,
                    'x_handle' => $candidate['xHandle'] ?? null,
                    'rank' => $candidate['rank'],
                ])->all();

            return [
                'key' => $key,
                'name' => $group->name,
                'hash' => hash('sha256', json_encode([
                    'version' => 2,
                    'key' => $key,
                    'candidate_ids' => collect($candidates)->pluck('id')->all(),
                ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)),
                'candidates' => $candidates,
            ];
        })
            ->filter(fn (array $group) => in_array($group['key'], self::ANNOUNCED_GROUPS, true))
            // Legacy key variants can normalize onto one key; the first group
            // (poll group order) wins so one state row exists per key.
            ->unique('key')
            ->values()
            ->all();

        return ['groups' => $groups];
    }

    private function scores(Poll $poll, Collection $candidates): Collection
    {
        if ($candidates->isEmpty()) {
            return collect();
        }

        // Split candidates so the common case is a single indexed
        // whereIn(poll_id, candidate_id) aggregation with no per-row
        // predicates. Only archived candidates with a term cutoff need an
        // extra day bound, and those are the only orWhere branches issued
        // (usually a handful, not one per candidate).
        $plainIds = [];
        $cutoffs = [];
        foreach ($candidates as $id => $candidate) {
            if (($candidate->status ?? null) === 'archived' && $candidate->term_ended_at) {
                $cutoffs[$id] = $candidate->term_ended_at;
            } else {
                $plainIds[] = $id;
            }
        }

        $base = fn () => DB::table('daily_scores')
            ->select('candidate_id', DB::raw('SUM(votes) as votes'), DB::raw('SUM(score) as score'))
            ->where('poll_id', $poll->id);

        $rows = collect();
        if ($plainIds !== []) {
            $rows = $rows->concat(
                $base()->whereIn('candidate_id', $plainIds)->groupBy('candidate_id')->get()
            );
        }
        if ($cutoffs !== []) {
            $rows = $rows->concat(
                $base()->where(function ($query) use ($cutoffs) {
                    foreach ($cutoffs as $id => $termEnd) {
                        $query->orWhere(function ($candidateQuery) use ($id, $termEnd) {
                            $candidateQuery->where('candidate_id', $id)
                                ->where('day', '<=', $termEnd instanceof \DateTimeInterface ? $termEnd->format('Y-m-d') : $termEnd);
                        });
                    }
                })->groupBy('candidate_id')->get()
            );
        }
        return $rows
            ->map(function ($row) use ($candidates) {
                $candidate = $candidates->get($row->candidate_id);

                return [
                    'candidateId' => $row->candidate_id,
                    'name' => $candidate?->name ?? '',
                    'title' => $candidate?->title,
                    'xHandle' => $candidate?->x_handle,
                    'imageUrl' => $candidate?->image_url,
                    'originalUrl' => $candidate?->image_url,
                    'category' => $candidate?->category,
                    'groupId' => $candidate?->candidate_group_id,
                    'status' => $candidate?->status ?? 'active',
                    'termStartedAt' => $candidate?->term_started_at?->toDateString(),
                    'termEndedAt' => $candidate?->term_ended_at?->toDateString(),
                    'archiveReason' => $candidate?->archive_reason,
                    'successorId' => $candidate?->successor_id,
                    'votes' => (int) $row->votes,
                    'score' => (int) $row->score,
                    'avg' => $row->votes > 0 ? round($row->score / $row->votes, 2) : 0,
                ];
            })
            ->sort(function (array $left, array $right) use ($candidates) {
                $comparison = $right['avg'] <=> $left['avg'];
                if ($comparison !== 0) {
                    return $comparison;
                }

                $comparison = $right['votes'] <=> $left['votes'];
                if ($comparison !== 0) {
                    return $comparison;
                }

                $comparison = ($candidates[$left['candidateId']]->sort ?? 0)
                    <=> ($candidates[$right['candidateId']]->sort ?? 0);

                return $comparison !== 0
                    ? $comparison
                    : strcmp($left['candidateId'], $right['candidateId']);
            })
            ->values();
    }

    public function normalizeGroupKey(string $key): string
    {
        return match ($key) {
            'minister' => 'ministers',
            'governor' => 'governors',
            'secur', 'security' => 'security',
            default => $key,
        };
    }
}
