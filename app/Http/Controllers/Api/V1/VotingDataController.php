<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Poll;
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
        'id', 'poll_id', 'candidate_group_id', 'name', 'title', 'image_url', 'category', 'sort',
        'status', 'term_started_at', 'term_ended_at', 'archive_reason', 'successor_id',
    ];
    private const BALLOT_COLUMNS = ['id', 'poll_id', 'vote_day', 'created_at'];

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

        $status = $request->query('status', 'all');
        if (!in_array($status, ['active', 'archived', 'all'], true)) {
            $status = 'all';
        }

        $query = $poll->candidates()->orderBy('sort');
        if ($status !== 'all') {
            $query->where('status', $status);
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

        $query = $poll->dailyScores()
            ->select(['candidate_id', 'day', 'votes', 'score'])
            ->orderBy('day')
            ->orderBy('candidate_id');

        if (!empty($filters['from'])) {
            $query->whereDate('day', '>=', $filters['from']);
        }
        if (!empty($filters['to'])) {
            $query->whereDate('day', '<=', $filters['to']);
        }
        if (!empty($filters['candidate_id'])) {
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

        $query = $poll->ballots()
            ->select(self::BALLOT_COLUMNS)
            ->with('items:id,ballot_id,candidate_id,tier,position')
            ->orderBy('vote_day')
            ->orderBy('id');

        if (!empty($filters['from'])) {
            $query->whereDate('vote_day', '>=', $filters['from']);
        }
        if (!empty($filters['to'])) {
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

    private function perPage(Request $request): int
    {
        $perPage = (int) $request->query('per_page', (string) self::DEFAULT_PER_PAGE);
        return max(1, min($perPage, self::MAX_PER_PAGE));
    }
}
