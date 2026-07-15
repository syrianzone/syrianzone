<?php

namespace App\Console\Commands;

use App\Models\Poll;
use App\Services\XApiClient;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Throwable;

class PostTierlistRankChanges extends Command
{
    protected $signature = 'tierlist:post-rank-changes {--dry-run : Print updates without posting or saving them}';

    protected $description = 'Post tierlist rank changes to X';

    public function handle(XApiClient $x): int
    {
        $poll = Poll::where('slug', 'best-ministers')->first();
        if (! $poll) {
            $this->error('The best-ministers poll does not exist.');

            return self::FAILURE;
        }

        $rankings = $this->rankings($poll->id);
        $previous = DB::table('daily_ranks')
            ->where('poll_id', $poll->id)
            ->whereIn('candidate_id', $rankings->pluck('candidate_id'))
            ->orderByDesc('day')
            ->get()
            ->unique('candidate_id')
            ->keyBy('candidate_id');

        $changes = 0;
        foreach ($rankings as $ranking) {
            $oldRank = $previous->get($ranking->candidate_id)?->rank;
            if ($oldRank === null) {
                if (! $this->option('dry-run')) {
                    $this->checkpoint($poll->id, $ranking);
                }

                continue;
            }
            if ((int) $oldRank === $ranking->rank) {
                if (! $this->option('dry-run')) {
                    $this->checkpoint($poll->id, $ranking);
                }

                continue;
            }

            $text = $this->postText($ranking, (int) $oldRank);
            $changes++;
            if ($this->option('dry-run')) {
                $this->line($text);

                continue;
            }

            try {
                $postId = $x->post($text);
                $this->checkpoint($poll->id, $ranking);
                $this->info("Posted {$ranking->name}: {$postId}");
            } catch (Throwable $exception) {
                report($exception);
                $this->error("Couldn't post {$ranking->name}: {$exception->getMessage()}");

                return self::FAILURE;
            }
        }

        if ($changes === 0) {
            $this->info('No rank changes.');
        }

        return self::SUCCESS;
    }

    private function rankings(string $pollId): Collection
    {
        $rows = DB::table('daily_scores')
            ->join('candidates', 'candidates.id', '=', 'daily_scores.candidate_id')
            ->join('candidate_groups', 'candidate_groups.id', '=', 'candidates.candidate_group_id')
            ->where('daily_scores.poll_id', $pollId)
            ->where('candidates.status', 'active')
            ->selectRaw('candidates.id as candidate_id, candidates.name, candidate_groups.id as group_id, candidate_groups.name as group_name, SUM(votes) as votes, SUM(score) as score')
            ->groupBy('candidates.id', 'candidates.name', 'candidate_groups.id', 'candidate_groups.name')
            ->get();

        return $rows->groupBy('group_id')->flatMap(function (Collection $group): Collection {
            return $group
                ->sort(fn ($a, $b) => (($b->score / $b->votes) <=> ($a->score / $a->votes))
                    ?: ($b->votes <=> $a->votes)
                    ?: strcmp($a->name, $b->name))
                ->values()
                ->map(function ($row, int $index) {
                    $row->rank = $index + 1;

                    return $row;
                });
        })->values();
    }

    private function postText(object $ranking, int $oldRank): string
    {
        $direction = $ranking->rank < $oldRank ? '⬆️' : '⬇️';

        return "تحديث ترتيب #التقييم_السوري\n{$ranking->name}: {$oldRank} ← {$ranking->rank} {$direction}\n{$ranking->group_name}\n".url('/tierlist/leaderboard');
    }

    private function checkpoint(string $pollId, object $ranking): void
    {
        DB::table('daily_ranks')->updateOrInsert(
            ['poll_id' => $pollId, 'candidate_id' => $ranking->candidate_id, 'day' => now()->startOfDay()],
            ['rank' => $ranking->rank, 'votes' => $ranking->votes, 'score' => $ranking->score, 'created_at' => now()]
        );
    }
}
