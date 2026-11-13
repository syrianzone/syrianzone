<?php

namespace App\Services;

use App\Models\Ballot;
use App\Models\BallotItem;
use App\Models\Candidate;
use App\Models\Poll;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
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
        $voteDay = Carbon::now($poll->safeTimezone())->startOfDay();

        $this->rejectIneligibleCandidates($poll, $tiers);

        // One ballot per device per poll per day. The DB unique index
        // (poll_id, vote_day, voter_key) is the source of truth; this
        // pre-check turns the common double-submit into a friendly 422
        // instead of a 500, while the unique index wins races.
        if (Ballot::where('poll_id', $poll->id)->where('vote_day', $voteDay)->where('voter_key', $voterKey)->exists()) {
            throw ValidationException::withMessages([
                'tiers' => 'You have already voted today.',
            ]);
        }

        try {
            DB::transaction(function () use ($poll, $voteDay, $voterKey, $ipHash, $userAgent, $tiers) {
                $ballot = Ballot::create([
                    'poll_id' => $poll->id,
                    'vote_day' => $voteDay,
                    'voter_key' => $voterKey,
                    'ip_hash' => $ipHash,
                    'user_agent' => $userAgent,
                ]);

                $scoreDelta = $this->calculateScores($ballot, $tiers);

                // Unknown-tier-only payloads would otherwise create an empty
                // ballot that counts as "voted" but scores nothing.
                if (empty($scoreDelta)) {
                    throw ValidationException::withMessages([
                        'tiers' => 'Ballot contains no valid candidates.',
                    ]);
                }

                $this->updateDailyScores($poll, $voteDay, $scoreDelta);
            });
        } catch (QueryException $e) {
            // Race: two concurrent submits passed the pre-check; the unique
            // index rejected the second. Report as already-voted, not 500.
            if (str_contains($e->getMessage(), 'ballots_poll_day_voter_unique') || ($e->errorInfo[1] ?? null) === 1062) {
                throw ValidationException::withMessages([
                    'tiers' => 'You have already voted today.',
                ]);
            }
            throw $e;
        }
    }

    /**
     * A ballot may only score candidates that are open for voting: they must
     * belong to this poll, not be archived, and not sit in a disabled category.
     * The middle check stops cross-poll ids; the last one stops a crafted
     * payload from voting in a category the admin took off the tierlist.
     */
    private function rejectIneligibleCandidates(Poll $poll, array $tiers): void
    {
        $ids = collect($tiers)
            ->flatten(1)
            ->pluck('candidateId')
            ->filter()
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return;
        }

        // One read answers all three questions. Candidates must exist AND
        // belong to this poll: without the scoping check, ids from other polls
        // would pass validation and their points would be written into this
        // poll's daily scores.
        $candidates = Candidate::where('poll_id', $poll->id)
            ->whereIn('id', $ids)
            ->get(['id', 'status', 'candidate_group_id']);

        if ($candidates->count() !== $ids->count()) {
            throw ValidationException::withMessages([
                'tiers' => 'Ballot contains candidates that do not belong to this poll.',
            ]);
        }

        if ($candidates->contains('status', 'archived')) {
            throw ValidationException::withMessages([
                'tiers' => 'Ballot contains archived candidates.',
            ]);
        }

        // A disabled category is unpublished, so its roster is not votable —
        // otherwise its scores could still move through the public API.
        $groupIds = $candidates->pluck('candidate_group_id')->filter()->unique()->values();

        if ($groupIds->isNotEmpty() && $poll->groups()->disabled()->whereIn('id', $groupIds)->exists()) {
            throw ValidationException::withMessages([
                'tiers' => 'Ballot contains candidates from a disabled category.',
            ]);
        }
    }

    private function calculateScores(Ballot $ballot, array $tiers): array
    {
        $allCandidateIds = collect($tiers)->flatten(1)->pluck('candidateId')->filter();
        if ($allCandidateIds->count() !== $allCandidateIds->unique()->count()) {
            throw ValidationException::withMessages([
                'tiers' => 'A candidate cannot appear in more than one tier.',
            ]);
        }

        $scoreDelta = [];
        $rows = [];

        foreach ($tiers as $tierKey => $items) {
            if (! isset(self::TIER_MINIMUMS[$tierKey])) {
                continue;
            }

            foreach ($items as $index => $item) {
                $candidateId = $item['candidateId'] ?? null;
                if (! $candidateId || ! is_string($candidateId)) {
                    throw ValidationException::withMessages([
                        'tiers' => 'Each tier item must reference a candidate.',
                    ]);
                }

                $rows[] = [
                    'id' => $ballot->newUniqueId(),
                    'ballot_id' => $ballot->id,
                    'candidate_id' => $candidateId,
                    'tier' => $tierKey,
                    'position' => $item['pos'] ?? $index,
                ];

                $points = self::TIER_MINIMUMS[$tierKey] + (self::TIER_BONUSES[$tierKey][$index] ?? 0);
                $scoreDelta[$candidateId] = [
                    'votes' => ($scoreDelta[$candidateId]['votes'] ?? 0) + 1,
                    'score' => ($scoreDelta[$candidateId]['score'] ?? 0) + $points,
                ];
            }
        }

        // One statement for the whole ballot rather than one per candidate.
        if ($rows !== []) {
            BallotItem::insert($rows);
        }

        return $scoreDelta;
    }

    /**
     * Add this ballot's points to the day's totals in a single upsert. Rows are
     * written in candidate order so two concurrent ballots take their row locks
     * in the same sequence.
     */
    private function updateDailyScores(Poll $poll, Carbon $voteDay, array $scoreDelta): void
    {
        if ($scoreDelta === []) {
            return;
        }

        ksort($scoreDelta);
        $now = now();
        $day = $voteDay->toDateString();

        $rows = [];
        foreach ($scoreDelta as $candidateId => $delta) {
            $rows[] = [
                'poll_id' => $poll->id,
                'candidate_id' => $candidateId,
                'day' => $day,
                'votes' => (int) $delta['votes'],
                'score' => (int) $delta['score'],
                'updated_at' => $now,
            ];
        }

        // The incoming row is VALUES(col) on MySQL/MariaDB and excluded.col on
        // SQLite/PostgreSQL.
        $incoming = in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)
            ? fn (string $column) => "VALUES({$column})"
            : fn (string $column) => "excluded.{$column}";

        DB::table('daily_scores')->upsert($rows, ['poll_id', 'candidate_id', 'day'], [
            'votes' => DB::raw('daily_scores.votes + '.$incoming('votes')),
            'score' => DB::raw('daily_scores.score + '.$incoming('score')),
            'updated_at' => $now,
        ]);
    }
}
