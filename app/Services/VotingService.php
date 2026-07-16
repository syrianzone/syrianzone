<?php

namespace App\Services;

use App\Models\Ballot;
use App\Models\BallotItem;
use App\Models\Candidate;
use App\Models\DailyScore;
use App\Models\Poll;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VotingService
{
    private const TIER_MINIMUMS = ['S' => 50, 'A' => 40, 'B' => 30, 'C' => 20, 'D' => 10, 'F' => 0];
    private const TIER_BONUSES = [
        'S' => [5, 3, 1, 0, 0, 0, 0, 0, 0, 0],
        'A' => [4, 2, 1, 0, 0, 0, 0, 0, 0, 0],
        'B' => [3, 2, 1, 0, 0, 0, 0, 0, 0, 0],
        'C' => [2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        'D' => [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        'F' => [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];

    public function submit(Poll $poll, array $tiers, string $voterKey, string $ipHash, ?string $userAgent): void
    {
        $voteDay = Carbon::now($poll->timezone ?: 'UTC')->startOfDay();

        $this->rejectArchivedCandidates($poll, $tiers);

        DB::transaction(function () use ($poll, $voteDay, $voterKey, $ipHash, $userAgent, $tiers) {
            $ballot = Ballot::create([
                'poll_id' => $poll->id,
                'vote_day' => $voteDay,
                'voter_key' => $voterKey,
                'ip_hash' => $ipHash,
                'user_agent' => $userAgent,
            ]);

            $scoreDelta = $this->calculateScores($ballot, $tiers);
            $this->updateDailyScores($poll, $voteDay, $scoreDelta);
        });
    }

    private function rejectArchivedCandidates(Poll $poll, array $tiers): void
    {
        $ids = collect($tiers)
            ->flatten(1)
            ->pluck('candidateId')
            ->filter()
            ->unique()
            ->values();

        if ($ids->isEmpty()) return;

        $archived = Candidate::where('poll_id', $poll->id)
            ->whereIn('id', $ids)
            ->where('status', 'archived')
            ->exists();

        if ($archived) {
            throw ValidationException::withMessages([
                'tiers' => 'Ballot contains archived candidates.',
            ]);
        }
    }

    private function calculateScores(Ballot $ballot, array $tiers): array
    {
        // Guard: ensure no candidate appears in more than one tier
        $allCandidateIds = collect($tiers)->flatten(1)->pluck('candidateId')->filter();
        if ($allCandidateIds->count() !== $allCandidateIds->unique()->count()) {
            throw ValidationException::withMessages([
                'tiers' => 'A candidate cannot appear in more than one tier.',
            ]);
        }

        $scoreDelta = [];

        foreach ($tiers as $tierKey => $items) {
            if (!isset(self::TIER_MINIMUMS[$tierKey])) continue;

            foreach ($items as $index => $item) {
                $candidateId = $item['candidateId'];

                BallotItem::create([
                    'ballot_id' => $ballot->id,
                    'candidate_id' => $candidateId,
                    'tier' => $tierKey,
                    'position' => $item['pos'] ?? $index,
                ]);

                $points = self::TIER_MINIMUMS[$tierKey] + (self::TIER_BONUSES[$tierKey][$index] ?? 0);
                $scoreDelta[$candidateId] = [
                    'votes' => ($scoreDelta[$candidateId]['votes'] ?? 0) + 1,
                    'score' => ($scoreDelta[$candidateId]['score'] ?? 0) + $points,
                ];
            }
        }

        return $scoreDelta;
    }

    private function updateDailyScores(Poll $poll, Carbon $voteDay, array $scoreDelta): void
    {
        foreach ($scoreDelta as $candidateId => $delta) {
            $where = [
                'poll_id' => $poll->id,
                'candidate_id' => $candidateId,
                'day' => $voteDay->toDateString(),
            ];
            $increments = [
                'votes' => DB::raw('votes + '.(int) $delta['votes']),
                'score' => DB::raw('score + '.(int) $delta['score']),
                'updated_at' => now(),
            ];

            $updated = DB::table('daily_scores')->where($where)->update($increments);
            if ($updated !== 0) {
                continue;
            }

            $inserted = DB::table('daily_scores')->insertOrIgnore([
                ...$where,
                'votes' => $delta['votes'],
                'score' => $delta['score'],
                'updated_at' => now(),
            ]);

            if ($inserted === 0) {
                DB::table('daily_scores')->where($where)->update($increments);
            }
        }
    }
}
