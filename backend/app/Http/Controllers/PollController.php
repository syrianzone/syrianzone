<?php

namespace App\Http\Controllers;

use App\Models\DailyScore;
use App\Models\Poll;
use App\Services\VotingService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PollController extends Controller
{
    public function index(Request $request)
    {
        return $request->user() ? Poll::all() : Poll::where('is_active', true)->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:200',
            'slug' => 'required|string|max:100|unique:polls',
            'timezone' => 'string|max:64',
            'is_active' => 'boolean',
        ]);

        return response()->json(Poll::create([
            'id' => (string) Str::uuid(),
            'timezone' => 'Europe/Amsterdam',
            'is_active' => true,
            ...$data,
        ]), 201);
    }

    public function update(Request $request, $id)
    {
        $poll = Poll::findOrFail($id);
        $poll->update($request->validate([
            'title' => 'string|max:200',
            'slug' => 'string|max:100|unique:polls,slug,' . $id,
            'timezone' => 'string|max:64',
            'is_active' => 'boolean',
        ]));
        return response()->json($poll);
    }

    public function destroy($id)
    {
        Poll::findOrFail($id)->delete();
        return response()->json(null, 204);
    }

    public function show($idOrSlug)
    {
        $poll = Poll::where('id', $idOrSlug)->orWhere('slug', $idOrSlug)->firstOrFail();
        $today = Carbon::now($poll->timezone ?: 'UTC')->startOfDay();

        return response()->json([
            'poll' => $poll,
            'groups' => $poll->groups,
            'candidates' => $poll->candidates()->where('status', 'active')->orderBy('sort')->get(),
            'todayScores' => DailyScore::where('poll_id', $poll->id)->where('day', $today)->get(),
            'voteDay' => $today->toIso8601String(),
        ]);
    }

    public function leaderboard(Request $request, $slug)
    {
        $poll = Poll::where('slug', $slug)->firstOrFail();
        $statusFilter = $request->query('status', 'active');
        if (!in_array($statusFilter, ['active', 'former', 'all'], true)) {
            $statusFilter = 'active';
        }

        $candidatesQuery = $poll->candidates()->orderBy('sort');
        if ($statusFilter === 'active') {
            $candidatesQuery->where('status', 'active');
        } elseif ($statusFilter === 'former') {
            $candidatesQuery->where('status', 'archived');
        }
        $candidates = $candidatesQuery->get()->keyBy('id');

        if ($candidates->isEmpty()) {
            $allTimeAgg = collect();
        } else {
            $allTimeAgg = DB::table('daily_scores')
                ->select('candidate_id', DB::raw('SUM(votes) as votes'), DB::raw('SUM(score) as score'))
                ->where('poll_id', $poll->id)
                ->whereIn('candidate_id', $candidates->keys())
                ->where(function ($q) use ($candidates) {
                    foreach ($candidates as $candidate) {
                        if ($candidate->status === 'archived' && $candidate->term_ended_at) {
                            $q->orWhere(function ($inner) use ($candidate) {
                                $inner->where('candidate_id', $candidate->id)
                                    ->where('day', '<=', $candidate->term_ended_at);
                            });
                        } else {
                            $q->orWhere('candidate_id', $candidate->id);
                        }
                    }
                })
                ->groupBy('candidate_id')
                ->get()
                ->map(fn($row) => $this->mapCandidateScore($row, $candidates))
                ->sortByDesc('avg')
                ->values();
        }

        $results = [
            'poll' => $poll,
            'groups' => $poll->groups,
            'status' => $statusFilter,
            'ministers' => [],
            'governors' => [],
            'security' => [],
            'jolani' => [],
            'history' => $this->getHistory($poll->id, $candidates),
        ];

        foreach ($poll->groups as $group) {
            $key = $this->normalizeGroupKey($group->key ?? $group->id);
            $results[$key] = $allTimeAgg
                ->filter(fn($item) => $item['groupId'] === $group->id)
                ->values()
                ->map(fn($item, $i) => [...$item, 'rank' => $i + 1]);
        }

        return response()->json($results);
    }

    public function submit(Request $request, VotingService $votingService)
    {
        $data = $request->validate([
            'pollSlug' => 'required|string',
            'tiers' => 'required|array',
            'deviceId' => 'required|string|min:8',
        ]);

        $totalAssigned = collect($data['tiers'])->flatten(1)->count();
        if ($totalAssigned < 3) {
            return response()->json(['error' => 'Minimum selection is 3'], 400);
        }

        $poll = Poll::where('slug', $data['pollSlug'])->firstOrFail();
        $votingService->submit(
            $poll,
            $data['tiers'],
            hash('sha256', $data['deviceId']),
            hash('sha256', $request->ip() ?: 'unknown'),
            $request->header('User-Agent')
        );

        return response()->json(['ok' => true]);
    }

    private function mapCandidateScore($row, $candidates): array
    {
        $c = $candidates->get($row->candidate_id);
        return [
            'candidateId' => $row->candidate_id,
            'name' => $c?->name ?? '',
            'title' => $c?->title,
            'imageUrl' => $c?->image_url,
            'category' => $c?->category,
            'groupId' => $c?->candidate_group_id,
            'status' => $c?->status ?? 'active',
            'termStartedAt' => $c?->term_started_at?->toDateString(),
            'termEndedAt' => $c?->term_ended_at?->toDateString(),
            'archiveReason' => $c?->archive_reason,
            'successorId' => $c?->successor_id,
            'votes' => (int) $row->votes,
            'score' => (int) $row->score,
            'avg' => $row->votes > 0 ? round($row->score / $row->votes, 2) : 0,
        ];
    }

    private function normalizeGroupKey($key): string
    {
        return match ($key) {
            'minister' => 'ministers',
            'governor' => 'governors',
            'secur', 'security' => 'security',
            default => $key
        };
    }

    private function getHistory($pollId, $candidates = null): array
    {
        $query = DB::table('daily_scores')
            ->where('poll_id', $pollId)
            ->select('candidate_id', 'day', 'votes', 'score')
            ->orderBy('day');

        if ($candidates !== null) {
            if ($candidates->isEmpty()) return [];
            $query->whereIn('candidate_id', $candidates->keys());
        }

        $rows = $query->get();

        if ($candidates !== null) {
            $rows = $rows->filter(function ($row) use ($candidates) {
                $c = $candidates->get($row->candidate_id);
                if (!$c) return false;
                if ($c->status === 'archived' && $c->term_ended_at) {
                    return $row->day <= $c->term_ended_at->toDateString();
                }
                return true;
            });
        }

        return $rows
            ->groupBy('candidate_id')
            ->map(fn($items) => $items->values()->map(fn($i) => [
                'date' => $i->day,
                'votes' => (int) $i->votes,
                'score' => (int) $i->score,
            ]))
            ->toArray();
    }
}
