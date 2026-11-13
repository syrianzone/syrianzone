<?php

namespace App\Http\Controllers;

use App\Models\DailyScore;
use App\Models\Poll;
use App\Services\Polls\PollRules;
use App\Services\TierlistLeaderboard;
use App\Services\VotingService;
use App\Support\Permissions\PermissionCatalogue;
use App\Support\Seo\SeoMeta;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
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

    /**
     * Whether the caller may see polls that are not currently running.
     *
     * Used by renderIndex() to decide between Poll::all() and the active-only
     * set. Seeing a deactivated poll is a moderation view, so it is gated on
     * polls.edit rather than on a role — which meant a capability-only staff
     * account was shown a polls tab and then an active-only list.
     *
     * This governs the *poll* list, in both renderIndex() and index(). It says
     * nothing about *candidates*: show() filters archived candidates on its own
     * `include_archived` flag, and deliberately does not consult this. Archived
     * candidates are already public — the guest-accessible
     * /api/polls/{slug}/leaderboard?status=former returns exactly the same rows —
     * so that flag is a rendering convenience, not a moderation boundary, and
     * gating it here would hide nothing.
     */
    private function canViewInactive(Request $request): bool
    {
        $user = $request->user();

        return $user !== null && $user->hasPermission(PermissionCatalogue::POLLS_EDIT);
    }

    public function renderShow(Request $request, $slug)
    {
        $poll = Poll::idOrSlug($slug)->firstOrFail();
        SeoMeta::remember($request, 'poll', $poll);
        $today = Carbon::now($poll->safeTimezone())->startOfDay();

        $groups = $poll->groups()->get();

        $candidates = $this->publicCandidates($poll, $request->boolean('include_archived'), $groups)
            ->get()->map(fn ($c) => [
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
            'groups' => $groups->where('is_active', true)->values(),
            'voteDay' => $today->toIso8601String(),
        ]);
    }

    public function renderLeaderboard(Request $request, $slug)
    {
        $validated = $request->validate(['status' => app(PollRules::class)->statusFilter()]);
        $poll = Poll::idOrSlug($slug)->firstOrFail();
        SeoMeta::remember($request, 'poll', $poll);
        $status = PollRules::normalizeStatus($validated['status'] ?? 'active');

        return Inertia::render('Polls/Leaderboard', $this->leaderboardPayload($poll, $status));
    }

    public function renderTierList(Request $request)
    {
        $poll = Poll::where('slug', Poll::coreSlug())->firstOrFail();
        $today = Carbon::now($poll->safeTimezone())->startOfDay();

        $groups = $poll->groups()->get();

        $candidates = $this->publicCandidates($poll, false, $groups)
            ->get()->map(fn ($c) => [
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
            'groups' => $groups->where('is_active', true)->values(),
            'voteDay' => $today->toIso8601String(),
        ]);
    }

    /**
     * The candidates a guest may see and rank: archived ones are included on
     * request, but anyone in a disabled category never is — a disabled
     * category is not published, so neither is its roster.
     */
    private function publicCandidates(Poll $poll, bool $includeArchived = false, ?Collection $groups = null)
    {
        $query = $poll->candidates()->orderBy('sort');

        if (! $includeArchived) {
            $query->where('status', 'active');
        }

        // Callers that also render the category list pass the groups they
        // already loaded, so the roster costs one groups query, not two.
        $disabledGroupIds = $groups !== null
            ? $groups->where('is_active', false)->pluck('id')
            : $poll->groups()->disabled()->pluck('id');

        return $query->outsideDisabledGroups($disabledGroupIds);
    }

    public function renderTierListLeaderboard(Request $request)
    {
        $validated = $request->validate(['status' => app(PollRules::class)->statusFilter()]);
        $poll = Poll::where('slug', Poll::coreSlug())->firstOrFail();
        $status = PollRules::normalizeStatus($validated['status'] ?? 'active');

        return Inertia::render('TierList/Leaderboard', $this->leaderboardPayload($poll, $status));
    }

    public function index(Request $request)
    {
        // Same gate as renderIndex(): the capability decides the same way
        // wherever the list is served.
        return $this->canViewInactive($request) ? Poll::all() : Poll::where('is_active', true)->get();
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
            'timezone' => Poll::defaultTimezone(),
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
        if ($poll->slug === Poll::coreSlug()
            && isset($validated['slug'])
            && $validated['slug'] !== Poll::coreSlug()) {
            return response()->json(['message' => 'Cannot rename the core Best Ministers poll.'], 403);
        }

        $poll->update($validated);

        return response()->json($poll);
    }

    public function destroy($id)
    {
        $poll = Poll::findOrFail($id);
        if ($poll->slug === Poll::coreSlug()) {
            return response()->json(['message' => 'Cannot delete the core Best Ministers poll.'], 403);
        }
        $poll->delete();

        return response()->json(null, 204);
    }

    public function show(Request $request, $idOrSlug)
    {
        $poll = Poll::idOrSlug($idOrSlug)->firstOrFail();
        $today = Carbon::now($poll->safeTimezone())->startOfDay();

        // The dashboard editor reads this endpoint and must still see disabled
        // categories (it is how they get re-enabled), so a polls editor gets the
        // full roster. Everyone else gets what the public pages show: published
        // categories only, and no candidate from a disabled one.
        $isEditor = $request->user()?->hasPermission(PermissionCatalogue::POLLS_EDIT) ?? false;

        $groups = $poll->groups()->get();

        $candidatesQuery = $isEditor
            ? $poll->candidates()->orderBy('sort')
            : $this->publicCandidates($poll, $request->boolean('include_archived'), $groups);

        if ($isEditor && ! $request->boolean('include_archived')) {
            $candidatesQuery->where('status', 'active');
        }

        return response()->json([
            'poll' => $poll,
            'groups' => $isEditor ? $groups : $groups->where('is_active', true)->values(),
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
        $validated = $request->validate(['status' => app(PollRules::class)->statusFilter()]);
        $poll = Poll::idOrSlug($slug)->firstOrFail();
        $status = PollRules::normalizeStatus($validated['status'] ?? 'active');
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
            // v2: groups are plain arrays carrying `rankingKey` (the payload
            // shape before it could not drive the leaderboard tabs).
            $this->tierlistLeaderboard->cacheKey($poll, $status),
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

    public function submit(Request $request, VotingService $votingService, ?string $idOrSlug = null)
    {
        if ($idOrSlug !== null && ! $request->filled('pollSlug')) {
            $request->merge(['pollSlug' => $idOrSlug]);
        }

        $data = $request->validate([
            'pollSlug' => 'required|string',
            'tiers' => 'required|array',
            'deviceId' => 'required|string|min:8',
        ]);

        $totalAssigned = collect($data['tiers'])->flatten(1)->count();
        if ($totalAssigned < 3) {
            return response()->json([
                'message' => 'Minimum selection is 3',
                'error' => 'Minimum selection is 3',
            ], 400);
        }

        $poll = Poll::idOrSlug($data['pollSlug'])->firstOrFail();
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
            // Primary-key order (poll_id, candidate_id, day): rows come back
            // already grouped per candidate and date-sorted, with no filesort.
            ->orderBy('candidate_id')
            ->orderBy('day');

        if ($candidates !== null) {
            if ($candidates->isEmpty()) {
                return [];
            }
            $query->whereIn('candidate_id', $candidates->keys());
        }

        // One pass. The rows arrive grouped per candidate and date-ordered (see
        // the ORDER BY above), so there is nothing to group or sort again; doing
        // that through collections cost more than the query for a year of
        // daily scores.
        $cutoffs = [];
        $history = [];

        foreach ($query->get() as $row) {
            $id = $row->candidate_id;

            if ($candidates !== null) {
                if (! array_key_exists($id, $cutoffs)) {
                    $c = $candidates->get($id);
                    // false: not one of ours. null: no cutoff. string: last day of the term.
                    $cutoffs[$id] = $c === null
                        ? false
                        : (($c->status === 'archived' && $c->term_ended_at) ? $c->term_ended_at->toDateString() : null);
                }
                if ($cutoffs[$id] === false || ($cutoffs[$id] !== null && ! ($row->day <= $cutoffs[$id]))) {
                    continue;
                }
            }

            $history[$id][] = [
                'date' => $row->day,
                'votes' => (int) $row->votes,
                'score' => (int) $row->score,
            ];
        }

        foreach ($history as $id => $series) {
            // Downsample long histories to weekly buckets (last point per
            // ISO week wins; the series is date-ordered). Charts cannot
            // render thousands of daily points, and the payload stays
            // bounded as the poll ages.
            if (count($series) > 180) {
                $bucketed = [];
                foreach ($series as $point) {
                    $bucketed[date('o-W', strtotime($point['date']))] = $point;
                }
                $history[$id] = array_values($bucketed);
            }
        }

        return $history;
    }
}
