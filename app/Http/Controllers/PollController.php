<?php

namespace App\Http\Controllers;

use App\Models\DailyScore;
use App\Models\Poll;
use App\Services\TierlistLeaderboard;
use App\Services\VotingService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
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
        $today = Carbon::now($poll->safeTimezone())->startOfDay();

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
        $validated = $request->validate([
            'status' => 'sometimes|string|in:active,archived,former,all',
        ]);
        $poll = Poll::where('id', $slug)->orWhere('slug', $slug)->firstOrFail();
        $status = TierlistLeaderboard::normalizeStatus($validated['status'] ?? 'active');

        return Inertia::render('Polls/Leaderboard', $this->leaderboardPayload($poll, $status));
    }

    public function renderTierList(Request $request)
    {
        $poll = Poll::where('slug', Poll::CORE_POLL_SLUG)->firstOrFail();
        $today = Carbon::now($poll->safeTimezone())->startOfDay();

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
        $validated = $request->validate([
            'status' => 'sometimes|string|in:active,archived,former,all',
        ]);
        $poll = Poll::where('slug', Poll::CORE_POLL_SLUG)->firstOrFail();
        $status = TierlistLeaderboard::normalizeStatus($validated['status'] ?? 'active');

        return Inertia::render('TierList/Leaderboard', $this->leaderboardPayload($poll, $status));
    }

    public function index(Request $request)
    {
        return $request->user() ? Poll::all() : Poll::where('is_active', true)->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:200',
            'slug' => 'required|string|max:100|alpha_dash|unique:polls,slug',
            'timezone' => 'nullable|string|max:64|timezone',
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
        $validated = $request->validate([
            'title' => 'sometimes|string|max:200',
            'slug' => 'sometimes|string|max:100|alpha_dash|unique:polls,slug,'.$id,
            'timezone' => 'nullable|string|max:64|timezone',
            'is_active' => 'boolean',
        ]);

        // Renaming the core poll away breaks /tierlist (renderTierList looks
        // it up by slug), the same way deleting it would.
        if ($poll->slug === Poll::CORE_POLL_SLUG
            && isset($validated['slug'])
            && $validated['slug'] !== Poll::CORE_POLL_SLUG) {
            return response()->json(['message' => 'Cannot rename the core Best Ministers poll.'], 403);
        }

        $poll->update($validated);

        return response()->json($poll);
    }

    public function destroy($id)
    {
        $poll = Poll::findOrFail($id);
        if ($poll->slug === Poll::CORE_POLL_SLUG) {
            return response()->json(['message' => 'Cannot delete the core Best Ministers poll.'], 403);
        }
        $poll->delete();

        return response()->json(null, 204);
    }

    public function show(Request $request, $idOrSlug)
    {
        $poll = Poll::where('id', $idOrSlug)->orWhere('slug', $idOrSlug)->firstOrFail();
        $today = Carbon::now($poll->safeTimezone())->startOfDay();

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
        // Resolve by UUID or slug (matches show()); canonical vocabulary is
        // active | former | all, with 'archived' accepted as an alias of
        // 'former'. Anything else is a 422, not a silent fallback to 'active'.
        $validated = $request->validate([
            'status' => 'sometimes|string|in:active,archived,former,all',
        ]);
        $poll = Poll::where('id', $slug)->orWhere('slug', $slug)->firstOrFail();
        $status = TierlistLeaderboard::normalizeStatus($validated['status'] ?? 'active');
        $results = $this->leaderboardPayload($poll, $status);

        $response = response()->json($results);
        // generated_at is part of the cached payload, so the ETag is stable
        // for the cache TTL and a second viewer within 60s gets a 304.
        $response->setEtag(sha1($response->getContent() ?: ''));
        $response->setPublic();
        $response->setMaxAge(60);
        $response->setSharedMaxAge(60);
        if ($response->isNotModified($request)) {
            return $response;
        }

        return $response;
    }

    /**
     * Full leaderboard payload, cached 60s per poll + status. History and
     * generated_at are inside the cached entry so every viewer in the same
     * minute sees identical bytes (and the same ETag).
     */
    private function leaderboardPayload(Poll $poll, string $status): array
    {
        return Cache::remember(
            "leaderboard:v1:{$poll->id}:{$status}",
            60,
            function () use ($poll, $status) {
                $leaderboard = $this->tierlistLeaderboard->build($poll, $status);

                return [
                    'poll' => $poll,
                    'groups' => $leaderboard['groups'],
                    'status' => $leaderboard['status'],
                    'generated_at' => now()->toIso8601String(),
                    ...$leaderboard['rankings'],
                    'history' => $this->getHistory($poll->id, $leaderboard['candidates']),
                ];
            }
        );
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
            ->map(function ($items) {
                $series = $items->sortBy('day')->values()->map(fn ($i) => [
                    'date' => $i->day,
                    'votes' => (int) $i->votes,
                    'score' => (int) $i->score,
                ])->all();

                // Downsample long histories to weekly buckets (last point per
                // ISO week wins; the series is date-ordered). Charts cannot
                // render thousands of daily points, and the payload stays
                // bounded as the poll ages.
                if (count($series) > 180) {
                    $bucketed = [];
                    foreach ($series as $point) {
                        $bucketed[date('o-W', strtotime($point['date']))] = $point;
                    }
                    $series = array_values($bucketed);
                }

                return $series;
            })
            ->toArray();
    }
}
