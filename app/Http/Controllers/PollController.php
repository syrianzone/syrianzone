<?php

namespace App\Http\Controllers;

use App\Models\DailyScore;
use App\Models\Poll;
use App\Services\TierlistLeaderboard;
use App\Services\VotingService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class PollController extends Controller
{
    public function __construct(private readonly TierlistLeaderboard $tierlistLeaderboard) {}

    public function renderIndex(Request $request)
    {
        // Mirror the JSON index(): inactive polls are only visible to admins,
        // never rendered to guests.
        $polls = $this->canViewInactive($request) ? Poll::all() : Poll::where('is_active', true)->get();

        return Inertia::render('Polls/Index', [
            'polls' => $polls,
        ]);
    }

    private function canViewInactive(Request $request): bool
    {
        $user = $request->user();

        return $user && in_array($user->role, ['admin', 'superadmin'], true);
    }

    public function renderShow(Request $request, $slug)
    {
        $poll = Poll::where('slug', $slug)->orWhere('id', $slug)->firstOrFail();
        $today = Carbon::now($poll->timezone ?: 'UTC')->startOfDay();

        $candidatesQuery = $poll->candidates()->orderBy('sort');
        if (! $request->boolean('include_archived')) {
            $candidatesQuery->where('status', 'active');
        }

        $candidates = $candidatesQuery->get()->map(fn ($c) => [
            'id' => $c->id,
            'name' => $c->name,
            'title' => $c->title,
            'imageUrl' => $c->image_url ?: null,
            'originalUrl' => $c->image_url ?: null,
            'category' => $c->category,
            'candidate_group_id' => $c->candidate_group_id,
        ]);

        return Inertia::render('Polls/Show', [
            'poll' => $poll,
            'candidates' => $candidates,
            'groups' => $poll->groups,
            'voteDay' => $today->toIso8601String(),
        ]);
    }

    public function renderLeaderboard(Request $request, $slug)
    {
        $response = $this->leaderboard($request, $slug);
        $data = json_decode($response->getContent(), true);

        return Inertia::render('Polls/Leaderboard', $data);
    }

    public function renderTierList(Request $request)
    {
        $poll = Poll::where('slug', 'best-ministers')->firstOrFail();
        $today = Carbon::now($poll->timezone ?: 'UTC')->startOfDay();

        $candidates = $poll->candidates()->where('status', 'active')->orderBy('sort')->get()->map(fn ($c) => [
            'id' => $c->id,
            'name' => $c->name,
            'title' => $c->title,
            'imageUrl' => $c->image_url ?: null,
            'originalUrl' => $c->image_url ?: null,
            'category' => $c->category,
            'candidate_group_id' => $c->candidate_group_id,
        ]);

        return Inertia::render('TierList/Index', [
            'poll' => $poll,
            'candidates' => $candidates,
            'groups' => $poll->groups,
            'voteDay' => $today->toIso8601String(),
        ]);
    }

    public function renderTierListLeaderboard(Request $request)
    {
        $response = $this->leaderboard($request, 'best-ministers');
        $data = json_decode($response->getContent(), true);

        return Inertia::render('TierList/Leaderboard', $data);
    }

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
            'slug' => 'string|max:100|unique:polls,slug,'.$id,
            'timezone' => 'string|max:64',
            'is_active' => 'boolean',
        ]));

        return response()->json($poll);
    }

    public function destroy($id)
    {
        $poll = Poll::findOrFail($id);
        if ($poll->slug === 'best-ministers') {
            return response()->json(['message' => 'Cannot delete the core Best Ministers poll.'], 403);
        }
        $poll->delete();

        return response()->json(null, 204);
    }

    public function show(Request $request, $idOrSlug)
    {
        $poll = Poll::where('id', $idOrSlug)->orWhere('slug', $idOrSlug)->firstOrFail();
        $today = Carbon::now($poll->timezone ?: 'UTC')->startOfDay();

        $candidatesQuery = $poll->candidates()->orderBy('sort');
        if (! $request->boolean('include_archived')) {
            $candidatesQuery->where('status', 'active');
        }

        return response()->json([
            'poll' => $poll,
            'groups' => $poll->groups,
            'candidates' => $candidatesQuery->get(),
            'todayScores' => DailyScore::where('poll_id', $poll->id)->where('day', $today)->get(),
            'voteDay' => $today->toIso8601String(),
        ]);
    }

    public function leaderboard(Request $request, $slug)
    {
        $poll = Poll::where('slug', $slug)->firstOrFail();
        $statusFilter = $request->query('status', 'active');
        $statusFilter = is_string($statusFilter) ? $statusFilter : 'active';
        $leaderboard = $this->tierlistLeaderboard->build($poll, $statusFilter);

        $results = [
            'poll' => $poll,
            'groups' => $leaderboard['groups'],
            'status' => $leaderboard['status'],
            ...$leaderboard['rankings'],
            'history' => $this->getHistory($poll->id, $leaderboard['candidates']),
        ];

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

    private function getHistory($pollId, $candidates = null): array
    {
        $query = DB::table('daily_scores')
            ->where('poll_id', $pollId)
            ->select('candidate_id', 'day', 'votes', 'score')
            ->orderBy('day');

        if ($candidates !== null) {
            if ($candidates->isEmpty()) {
                return [];
            }
            $query->whereIn('candidate_id', $candidates->keys());
        }

        $rows = $query->get();

        if ($candidates !== null) {
            $rows = $rows->filter(function ($row) use ($candidates) {
                $c = $candidates->get($row->candidate_id);
                if (! $c) {
                    return false;
                }
                if ($c->status === 'archived' && $c->term_ended_at) {
                    return $row->day <= $c->term_ended_at->toDateString();
                }

                return true;
            });
        }

        return $rows
            ->groupBy('candidate_id')
            ->map(fn ($items) => $items->values()->map(fn ($i) => [
                'date' => $i->day,
                'votes' => (int) $i->votes,
                'score' => (int) $i->score,
            ]))
            ->toArray();
    }
}
