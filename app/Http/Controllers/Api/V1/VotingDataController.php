<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Poll;
use App\Services\TierlistLeaderboard;
use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * Public read-only voting data API (issue #53).
 *
 * Exposes raw voting data for power users. Voter-identifying columns
 * (voter_key, ip_hash, user_agent) and user-specific columns (polls.user_id)
 * are never selected here; keep it that way when extending this controller.
 */
class VotingDataController extends Controller
{
    private const MAX_PER_PAGE = 1000;

    private const DEFAULT_PER_PAGE = 100;

    private const POLL_COLUMNS = ['id', 'slug', 'title', 'timezone', 'is_active', 'created_at', 'updated_at'];

    private const GROUP_COLUMNS = ['id', 'poll_id', 'name', 'key', 'sort_order', 'is_default'];

    private const CANDIDATE_COLUMNS = [
        'id', 'poll_id', 'candidate_group_id', 'name', 'title', 'x_handle', 'image_url', 'category', 'sort',
        'status', 'term_started_at', 'term_ended_at', 'archive_reason', 'successor_id',
    ];

    private const BALLOT_COLUMNS = ['id', 'poll_id', 'vote_day', 'created_at'];

    /**
     * Maximum inclusive date span for scores/ballots scans. The (poll_id,
     * vote_day) index bounds each page, but an unbounded range is still a
     * full-table walk — reject it with a 422 instead of serving it slowly.
     */
    private const MAX_DATE_SPAN_DAYS = 31;

    public function index()
    {
        return response()->json(
            Poll::where('is_active', true)->orderBy('created_at')->get(self::POLL_COLUMNS)
        );
    }

    public function show($idOrSlug)
    {
        $poll = $this->findPoll($idOrSlug);

        return response()->json([
            'poll' => $poll,
            'groups' => $poll->groups()->get(self::GROUP_COLUMNS),
            'candidates' => $poll->candidates()->orderBy('sort')->get(self::CANDIDATE_COLUMNS),
        ]);
    }

    public function candidates(Request $request, $idOrSlug)
    {
        $poll = $this->findPoll($idOrSlug);

        // Same vocabulary as the legacy leaderboard (see
        // TierlistLeaderboard::STATUSES): active | former | all, with
        // 'archived' accepted as an alias of 'former'. Invalid values are
        // a 422, not a silent default.
        $validated = $request->validate([
            'status' => 'sometimes|string|in:active,former,all,archived',
        ]);
        $status = TierlistLeaderboard::normalizeStatus($validated['status'] ?? 'all');

        $query = $poll->candidates()->orderBy('sort');
        if ($status !== 'all') {
            // 'former' is the public name for the 'archived' DB value.
            $query->where('status', $status === 'former' ? 'archived' : $status);
        }

        return response()->json($query->get(self::CANDIDATE_COLUMNS));
    }

    public function scores(Request $request, $idOrSlug)
    {
        $poll = $this->findPoll($idOrSlug);
        $filters = $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'candidate_id' => 'nullable|uuid',
        ]);
        $this->assertDateSpan($filters['from'] ?? null, $filters['to'] ?? null);

        $query = $poll->dailyScores()
            ->select(['candidate_id', 'day', 'votes', 'score'])
            ->orderBy('day')
            ->orderBy('candidate_id');

        if (! empty($filters['from'])) {
            $query->whereDate('day', '>=', $filters['from']);
        }
        if (! empty($filters['to'])) {
            $query->whereDate('day', '<=', $filters['to']);
        }
        if (! empty($filters['candidate_id'])) {
            $query->where('candidate_id', $filters['candidate_id']);
        }

        return response()->json($query->paginate($this->perPage($request)));
    }

    public function ballots(Request $request, $idOrSlug)
    {
        $poll = $this->findPoll($idOrSlug);
        $filters = $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date',
        ]);
        $this->assertDateSpan($filters['from'] ?? null, $filters['to'] ?? null);

        $query = $poll->ballots()
            ->select(self::BALLOT_COLUMNS)
            ->with('items:id,ballot_id,candidate_id,tier,position')
            ->orderBy('vote_day')
            ->orderBy('id');

        if (! empty($filters['from'])) {
            $query->whereDate('vote_day', '>=', $filters['from']);
        }
        if (! empty($filters['to'])) {
            $query->whereDate('vote_day', '<=', $filters['to']);
        }

        return response()->json($query->paginate($this->perPage($request)));
    }

    private function findPoll($idOrSlug): Poll
    {
        return Poll::where('id', $idOrSlug)
            ->orWhere('slug', $idOrSlug)
            ->firstOrFail(self::POLL_COLUMNS);
    }

    private function assertDateSpan(?string $from, ?string $to): void
    {
        if ($from === null || $to === null) {
            return;
        }

        $span = Carbon::parse($from)->startOfDay()
            ->diffInDays(Carbon::parse($to)->startOfDay(), true);

        if ($span > self::MAX_DATE_SPAN_DAYS) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'to' => 'Date range must not exceed ' . self::MAX_DATE_SPAN_DAYS . ' days.',
            ]);
        }
    }

    private function perPage(Request $request): int
    {
        $perPage = (int) $request->query('per_page', (string) self::DEFAULT_PER_PAGE);

        return max(1, min($perPage, self::MAX_PER_PAGE));
    }
}
