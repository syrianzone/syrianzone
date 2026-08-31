<?php

namespace App\Services;

use App\Models\Poll;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class TierlistLeaderboard
{
    public function build(Poll $poll, string $status = 'active'): array
    {
        $status = in_array($status, ['active', 'former', 'all'], true) ? $status : 'active';
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

        return DB::table('daily_scores')
            ->select('candidate_id', DB::raw('SUM(votes) as votes'), DB::raw('SUM(score) as score'))
            ->where('poll_id', $poll->id)
            ->whereIn('candidate_id', $candidates->keys())
            ->where(function ($query) use ($candidates) {
                foreach ($candidates as $candidate) {
                    if ($candidate->status === 'archived' && $candidate->term_ended_at) {
                        $query->orWhere(function ($candidateQuery) use ($candidate) {
                            $candidateQuery->where('candidate_id', $candidate->id)
                                ->where('day', '<=', $candidate->term_ended_at);
                        });
                    } else {
                        $query->orWhere('candidate_id', $candidate->id);
                    }
                }
            })
            ->groupBy('candidate_id')
            ->get()
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
