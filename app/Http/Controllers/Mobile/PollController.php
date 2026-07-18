<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Models\DailyScore;
use App\Models\Poll;
use App\Services\VotingService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PollController extends Controller
{
    private const HISTORY_DAYS_MAXIMUM = 730;

    private const TIER_KEYS = ['S', 'A', 'B', 'C', 'D', 'F'];

    public function index(): JsonResponse
    {
        $polls = Poll::query()
            ->where('is_active', true)
            ->orderBy('created_at')
            ->get()
            ->map(fn (Poll $poll) => $this->pollResource($poll))
            ->values();

        return response()->json(['data' => $polls]);
    }

    public function adminIndex(): JsonResponse
    {
        $polls = Poll::query()
            ->orderBy('created_at')
            ->get()
            ->map(fn (Poll $poll) => [
                ...$this->pollResource($poll),
                'candidatesCount' => $poll->candidates()->count(),
            ])
            ->values();

        return response()->json(['data' => $polls]);
    }

    public function adminShow(string $id): JsonResponse
    {
        $poll = Poll::findOrFail($id);

        return response()->json(['data' => [
            'candidates' => $poll->candidates()->orderBy('sort')->orderBy('id')->get()
                ->map(fn (Candidate $candidate) => $this->candidateResource($candidate))->values(),
            'groups' => $this->groupResources($poll),
            'poll' => $this->pollResource($poll),
        ]]);
    }

    public function adminStorePoll(Request $request): JsonResponse
    {
        $data = $this->validatePoll($request);
        $poll = Poll::create([
            'id' => (string) Str::uuid(),
            'is_active' => $data['isActive'],
            'slug' => $data['slug'],
            'timezone' => $data['timezone'],
            'title' => $data['title'],
            'user_id' => $request->user()->id,
        ]);

        return response()->json(['data' => $this->pollResource($poll)], 201);
    }

    public function adminUpdatePoll(Request $request, string $id): JsonResponse
    {
        $poll = Poll::findOrFail($id);
        $data = $this->validatePoll($request, $poll);
        $poll->update([
            'is_active' => $data['isActive'],
            'slug' => $data['slug'],
            'timezone' => $data['timezone'],
            'title' => $data['title'],
        ]);

        return response()->json(['data' => $this->pollResource($poll->fresh())]);
    }

    public function adminDestroyPoll(string $id): JsonResponse
    {
        $poll = Poll::findOrFail($id);
        if ($poll->slug === 'best-ministers') {
            return response()->json(['message' => 'لا يمكن حذف استطلاع تقييم الحكومة الأساسي.'], 403);
        }
        $poll->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function adminStoreGroup(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'pollId' => 'required|uuid|exists:polls,id',
        ]);
        $group = CandidateGroup::create([
            'name' => $data['name'],
            'poll_id' => $data['pollId'],
            'sort_order' => (CandidateGroup::where('poll_id', $data['pollId'])->max('sort_order') ?? -1) + 1,
        ]);

        return response()->json(['data' => $this->groupResource($group)], 201);
    }

    public function adminUpdateGroup(Request $request, string $id): JsonResponse
    {
        $group = CandidateGroup::findOrFail($id);
        $group->update($request->validate(['name' => 'required|string|max:255']));

        return response()->json(['data' => $this->groupResource($group->fresh())]);
    }

    public function adminDestroyGroup(string $id): JsonResponse
    {
        CandidateGroup::findOrFail($id)->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function adminReorderGroups(Request $request): JsonResponse
    {
        $data = $request->validate([
            'groups' => 'required|array|min:1|max:50',
            'groups.*.id' => 'required|uuid|distinct|exists:candidate_groups,id',
            'groups.*.sortOrder' => 'required|integer|min:0|max:49',
        ]);
        $ids = collect($data['groups'])->pluck('id');
        if (CandidateGroup::whereIn('id', $ids)->pluck('poll_id')->unique()->count() !== 1) {
            throw ValidationException::withMessages(['groups' => 'يجب أن تنتمي كل المجموعات إلى الاستطلاع نفسه.']);
        }
        DB::transaction(function () use ($data): void {
            foreach ($data['groups'] as $item) {
                CandidateGroup::whereKey($item['id'])->update(['sort_order' => $item['sortOrder']]);
            }
        });
        $groups = CandidateGroup::whereIn('id', $ids)->orderBy('sort_order')->get()
            ->map(fn (CandidateGroup $group) => $this->groupResource($group))->values();

        return response()->json(['data' => ['groups' => $groups]]);
    }

    public function adminDefaultGroup(string $id): JsonResponse
    {
        $group = CandidateGroup::findOrFail($id);
        DB::transaction(function () use ($group): void {
            CandidateGroup::where('poll_id', $group->poll_id)->update(['is_default' => false]);
            $group->update(['is_default' => true]);
        });

        return response()->json(['data' => $this->groupResource($group->fresh())]);
    }

    public function adminStoreCandidate(Request $request): JsonResponse
    {
        $data = $this->validateCandidate($request);
        $candidate = Candidate::create([
            'candidate_group_id' => $data['groupId'],
            'category' => 'minister',
            'image_url' => $data['imageUrl'],
            'name' => $data['name'],
            'poll_id' => $data['pollId'],
            'sort' => (Candidate::where('poll_id', $data['pollId'])->max('sort') ?? -1) + 1,
            'title' => $data['title'],
        ]);

        return response()->json(['data' => $this->candidateResource($candidate)], 201);
    }

    public function adminUpdateCandidate(Request $request, string $id): JsonResponse
    {
        $candidate = Candidate::findOrFail($id);
        $data = $this->validateCandidate($request, $candidate);
        $candidate->update([
            'candidate_group_id' => $data['groupId'],
            'image_url' => $data['imageUrl'],
            'name' => $data['name'],
            'title' => $data['title'],
        ]);

        return response()->json(['data' => $this->candidateResource($candidate->fresh())]);
    }

    public function adminDestroyCandidate(string $id): JsonResponse
    {
        Candidate::findOrFail($id)->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function adminArchiveCandidate(Request $request, string $id): JsonResponse
    {
        $candidate = Candidate::findOrFail($id);
        $data = $request->validate([
            'archiveReason' => 'nullable|string|max:200',
            'successorId' => [
                'nullable',
                'uuid',
                Rule::exists('candidates', 'id')->where('poll_id', $candidate->poll_id),
                Rule::notIn([$candidate->id]),
            ],
            'termEndedAt' => 'nullable|date',
        ]);
        $termEndedAt = $data['termEndedAt'] ?? now()->toDateString();
        $candidate->update([
            'archive_reason' => $data['archiveReason'] ?? null,
            'status' => 'archived',
            'successor_id' => $data['successorId'] ?? null,
            'term_ended_at' => $termEndedAt,
        ]);
        if (! empty($data['successorId'])) {
            Candidate::whereKey($data['successorId'])->whereNull('term_started_at')->update(['term_started_at' => $termEndedAt]);
        }

        return response()->json(['data' => $this->candidateResource($candidate->fresh())]);
    }

    public function adminRestoreCandidate(string $id): JsonResponse
    {
        $candidate = Candidate::findOrFail($id);
        $candidate->update([
            'archive_reason' => null,
            'status' => 'active',
            'successor_id' => null,
            'term_ended_at' => null,
        ]);

        return response()->json(['data' => $this->candidateResource($candidate->fresh())]);
    }

    public function show(string $idOrSlug): JsonResponse
    {
        $poll = $this->activePoll($idOrSlug);
        $voteDay = $this->voteDay($poll);
        $candidates = $poll->candidates()
            ->where('status', 'active')
            ->orderBy('sort')
            ->orderBy('id')
            ->get()
            ->map(fn (Candidate $candidate) => $this->candidateResource($candidate))
            ->values();
        $scores = DailyScore::query()
            ->where('poll_id', $poll->id)
            ->whereDate('day', $voteDay)
            ->get()
            ->map(fn (DailyScore $score) => [
                'candidateId' => $score->candidate_id,
                'day' => Carbon::parse($score->day)->toDateString(),
                'score' => (int) $score->score,
                'votes' => (int) $score->votes,
            ])
            ->values();

        return response()->json([
            'data' => [
                'candidates' => $candidates,
                'groups' => $this->groupResources($poll),
                'poll' => $this->pollResource($poll),
                'todayScores' => $scores,
                'voteDay' => $voteDay,
            ],
        ]);
    }

    public function leaderboard(Request $request, string $idOrSlug): JsonResponse
    {
        $poll = $this->activePoll($idOrSlug);
        $data = $request->validate([
            'history_days' => 'sometimes|integer|min:7|max:'.self::HISTORY_DAYS_MAXIMUM,
            'status' => 'sometimes|string|max:20',
        ]);
        $status = in_array($data['status'] ?? 'active', ['active', 'former', 'all'], true)
          ? $data['status'] ?? 'active'
          : 'active';
        $historyDays = (int) ($data['history_days'] ?? 365);
        $candidatesQuery = $poll->candidates()->orderBy('sort')->orderBy('id');

        if ($status === 'active') {
            $candidatesQuery->where('status', 'active');
        } elseif ($status === 'former') {
            $candidatesQuery->where('status', 'archived');
        }

        $candidates = $candidatesQuery->get()->keyBy('id');
        $scores = $this->aggregateScores($poll, $candidates);
        $rankings = [];

        foreach ($poll->groups()->orderBy('sort_order')->get() as $group) {
            $key = $this->normalizeGroupKey($group->key ?: $group->id);
            $rankings[$key] = $scores
                ->where('groupId', $group->id)
                ->values()
                ->map(fn (array $item, int $index) => [
                    ...$item,
                    'rank' => $index + 1,
                ]);
        }

        return response()->json([
            'data' => [
                'groups' => $this->groupResources($poll),
                'history' => $this->history($poll, $candidates, $historyDays),
                'historyDays' => $historyDays,
                'poll' => $this->pollResource($poll),
                'rankings' => (object) $rankings,
                'status' => $status,
            ],
        ]);
    }

    public function vote(
        Request $request,
        VotingService $votingService,
        string $idOrSlug,
    ): JsonResponse {
        $poll = $this->activePoll($idOrSlug);
        $data = $request->validate([
            'installationId' => 'required|string|min:8|max:200',
            'tiers' => 'required|array:S,A,B,C,D,F',
            'tiers.*' => 'array|max:100',
            'tiers.*.*' => 'array:candidateId,pos',
            'tiers.*.*.candidateId' => 'required|uuid',
            'tiers.*.*.pos' => 'sometimes|integer|min:0|max:99',
        ]);
        $items = collect($data['tiers'])->flatten(1);

        if ($items->count() < 3 || $items->count() > 100) {
            throw ValidationException::withMessages([
                'tiers' => 'Choose between 3 and 100 candidates.',
            ]);
        }

        $candidateIds = $items->pluck('candidateId');
        if ($candidateIds->unique()->count() !== $candidateIds->count()) {
            throw ValidationException::withMessages([
                'tiers' => 'A candidate cannot appear more than once.',
            ]);
        }

        $activeCandidateCount = Candidate::query()
            ->where('poll_id', $poll->id)
            ->where('status', 'active')
            ->whereIn('id', $candidateIds)
            ->count();
        if ($activeCandidateCount !== $candidateIds->count()) {
            throw ValidationException::withMessages([
                'tiers' => 'Every candidate must be active and belong to this poll.',
            ]);
        }

        $voteDay = $this->voteDay($poll);
        $installationHash = hash('sha256', $data['installationId']);
        $ipHash = $this->privateHash($request->ip() ?: 'unknown');
        $userAgent = $request->userAgent();
        $userAgentHash = $userAgent === null ? null : $this->privateHash($userAgent);
        $maxNetworkBallots = max(
            1,
            (int) config('mobile-polls.max_ballots_per_network_per_day', 5),
        );
        $voteStatus = DB::transaction(function () use (
            $data,
            $installationHash,
            $ipHash,
            $maxNetworkBallots,
            $poll,
            $userAgentHash,
            $voteDay,
            $votingService,
        ): string {
            $receiptQuery = DB::table('mobile_poll_vote_receipts')
                ->where('poll_id', $poll->id)
                ->where('vote_day', $voteDay);

            if ((clone $receiptQuery)->where('installation_hash', $installationHash)->exists()) {
                return 'installation_duplicate';
            }

            $networkBallots = (clone $receiptQuery)
                ->where('ip_hash', $ipHash)
                ->lockForUpdate()
                ->count();
            if ($networkBallots >= $maxNetworkBallots) {
                return 'network_limit';
            }

            $inserted = DB::table('mobile_poll_vote_receipts')->insertOrIgnore([
                'created_at' => now(),
                'installation_hash' => $installationHash,
                'ip_hash' => $ipHash,
                'poll_id' => $poll->id,
                'updated_at' => now(),
                'vote_day' => $voteDay,
            ]);

            if ($inserted !== 1) {
                return 'installation_duplicate';
            }

            $votingService->submit(
                $poll,
                $data['tiers'],
                $installationHash,
                $ipHash,
                $userAgentHash,
            );

            return 'accepted';
        });

        if ($voteStatus === 'network_limit') {
            return response()->json([
                'code' => 'network_vote_limit_reached',
                'message' => 'تم بلوغ حد الحماية من إساءة الاستخدام لهذه الشبكة اليوم.',
            ], 429);
        }

        if ($voteStatus !== 'accepted') {
            return response()->json([
                'code' => 'already_voted_today',
                'message' => 'تم تسجيل تصويت من هذا الجهاز لهذا الاستطلاع اليوم.',
            ], 409);
        }

        return response()->json([
            'data' => [
                'accepted' => true,
                'voteDay' => $voteDay,
            ],
        ], 201);
    }

    private function activePoll(string $idOrSlug): Poll
    {
        return Poll::query()
            ->where('is_active', true)
            ->where(function (EloquentBuilder $query) use ($idOrSlug) {
                $query->where('id', $idOrSlug)->orWhere('slug', $idOrSlug);
            })
            ->firstOrFail();
    }

    private function aggregateScores(Poll $poll, Collection $candidates): Collection
    {
        if ($candidates->isEmpty()) {
            return collect();
        }

        return DB::table('daily_scores')
            ->select(
                'candidate_id',
                DB::raw('SUM(votes) as votes'),
                DB::raw('SUM(score) as score'),
            )
            ->where('poll_id', $poll->id)
            ->whereIn('candidate_id', $candidates->keys())
            ->where(function (Builder $query) use ($candidates) {
                foreach ($candidates as $candidate) {
                    $query->orWhere(function (Builder $candidateQuery) use ($candidate) {
                        $candidateQuery->where('candidate_id', $candidate->id);
                        if ($candidate->status === 'archived' && $candidate->term_ended_at) {
                            $candidateQuery->whereDate('day', '<=', $candidate->term_ended_at);
                        }
                    });
                }
            })
            ->groupBy('candidate_id')
            ->get()
            ->map(function ($row) use ($candidates): array {
                $candidate = $candidates->get($row->candidate_id);
                $votes = (int) $row->votes;
                $score = (int) $row->score;

                return [
                    'archiveReason' => $candidate?->archive_reason,
                    'avg' => $votes > 0 ? round($score / $votes, 2) : 0,
                    'candidateId' => $row->candidate_id,
                    'category' => $candidate?->category,
                    'groupId' => $candidate?->candidate_group_id,
                    'imageUrl' => $candidate?->image_url,
                    'name' => $candidate?->name ?? '',
                    'score' => $score,
                    'status' => $candidate?->status ?? 'active',
                    'successorId' => $candidate?->successor_id,
                    'termEndedAt' => $candidate?->term_ended_at?->toDateString(),
                    'termStartedAt' => $candidate?->term_started_at?->toDateString(),
                    'title' => $candidate?->title,
                    'votes' => $votes,
                ];
            })
            ->sortByDesc('avg')
            ->values();
    }

    private function candidateResource(Candidate $candidate): array
    {
        return [
            'archiveReason' => $candidate->archive_reason,
            'category' => $candidate->category,
            'groupId' => $candidate->candidate_group_id,
            'id' => $candidate->id,
            'imageUrl' => $candidate->image_url,
            'name' => $candidate->name,
            'status' => $candidate->status ?? 'active',
            'successorId' => $candidate->successor_id,
            'termEndedAt' => $candidate->term_ended_at?->toDateString(),
            'termStartedAt' => $candidate->term_started_at?->toDateString(),
            'title' => $candidate->title,
        ];
    }

    private function groupResource(CandidateGroup $group): array
    {
        return [
            'id' => $group->id,
            'isDefault' => (bool) $group->is_default,
            'key' => $group->key,
            'name' => $group->name,
            'pollId' => $group->poll_id,
            'sortOrder' => (int) $group->sort_order,
        ];
    }

    private function groupResources(Poll $poll): Collection
    {
        return $poll->groups()
            ->orderBy('sort_order')
            ->get()
            ->map(fn (CandidateGroup $group) => $this->groupResource($group))
            ->values();
    }

    private function history(Poll $poll, Collection $candidates, int $days): object
    {
        if ($candidates->isEmpty()) {
            return (object) [];
        }

        $firstDay = Carbon::now($poll->timezone ?: 'UTC')
            ->startOfDay()
            ->subDays($days - 1)
            ->toDateString();
        $history = DB::table('daily_scores')
            ->where('poll_id', $poll->id)
            ->whereIn('candidate_id', $candidates->keys())
            ->whereDate('day', '>=', $firstDay)
            ->orderBy('day')
            ->get()
            ->filter(function ($row) use ($candidates): bool {
                $candidate = $candidates->get($row->candidate_id);
                if (! $candidate) {
                    return false;
                }

                return ! (
                    $candidate->status === 'archived'
                    && $candidate->term_ended_at
                    && $row->day > $candidate->term_ended_at->toDateString()
                );
            })
            ->groupBy('candidate_id')
            ->map(fn (Collection $items) => $items->map(fn ($item) => [
                'date' => Carbon::parse($item->day)->toDateString(),
                'score' => (int) $item->score,
                'votes' => (int) $item->votes,
            ])->values())
            ->all();

        return (object) $history;
    }

    private function normalizeGroupKey(string $key): string
    {
        return match ($key) {
            'governor' => 'governors',
            'minister' => 'ministers',
            'secur', 'security' => 'security',
            default => $key,
        };
    }

    private function validateCandidate(Request $request, ?Candidate $candidate = null): array
    {
        $pollId = $candidate?->poll_id ?? $request->input('pollId');

        return $request->validate([
            'groupId' => [
                'nullable',
                'uuid',
                Rule::exists('candidate_groups', 'id')->where('poll_id', $pollId),
            ],
            'imageUrl' => 'nullable|string|max:2048',
            'name' => 'required|string|max:255',
            'pollId' => [$candidate ? 'sometimes' : 'required', 'uuid', 'exists:polls,id'],
            'title' => 'nullable|string|max:255',
        ]) + ['pollId' => $pollId];
    }

    private function validatePoll(Request $request, ?Poll $poll = null): array
    {
        return $request->validate([
            'isActive' => 'required|boolean',
            'slug' => ['required', 'string', 'max:100', Rule::unique('polls', 'slug')->ignore($poll?->id)],
            'timezone' => 'required|timezone|max:64',
            'title' => 'required|string|max:200',
        ]);
    }

    private function pollResource(Poll $poll): array
    {
        return [
            'id' => $poll->id,
            'isActive' => (bool) $poll->is_active,
            'slug' => $poll->slug,
            'timezone' => $poll->timezone ?: 'UTC',
            'title' => $poll->title,
        ];
    }

    private function privateHash(string $value): string
    {
        return hash_hmac('sha256', $value, (string) config('app.key'));
    }

    private function voteDay(Poll $poll): string
    {
        return Carbon::now($poll->timezone ?: 'UTC')->startOfDay()->toDateString();
    }
}
