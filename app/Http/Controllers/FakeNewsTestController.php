<?php

namespace App\Http\Controllers;

use App\Support\Facts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FakeNewsTestController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('FakeNewsTest/Index', [
            'initialStats' => $this->statsSnapshot(),
        ]);
    }

    public function stats(): JsonResponse
    {
        return response()->json($this->statsSnapshot());
    }

    public function recordAnswer(Request $request): JsonResponse
    {
        $claimIds = $this->claimIds();

        $validated = $request->validate([
            'claim_id' => ['required', 'string', Rule::in($claimIds)],
            'answer' => ['required', 'boolean'],
        ]);

        $claimId = $validated['claim_id'];
        $column = $request->boolean('answer') ? 'true_count' : 'false_count';

        DB::transaction(function () use ($claimId, $column): void {
            DB::table('fake_news_claim_stats')->insertOrIgnore([
                'claim_id' => $claimId,
                'true_count' => 0,
                'false_count' => 0,
            ]);

            DB::table('fake_news_claim_stats')
                ->where('claim_id', $claimId)
                ->increment($column);
        });

        return response()->json([
            'ok' => true,
            'stats' => $this->statsSnapshot(),
        ]);
    }

    public function recordResult(Request $request): JsonResponse
    {
        $maxScore = count($this->claimIds());

        $validated = $request->validate([
            'score' => ['required', 'integer', 'min:0', "max:{$maxScore}"],
        ]);

        $score = (int) $validated['score'];

        DB::transaction(function () use ($score): void {
            DB::table('fake_news_score_stats')->insertOrIgnore([
                'score' => $score,
                'runs_count' => 0,
            ]);

            DB::table('fake_news_score_stats')
                ->where('score', $score)
                ->increment('runs_count');
        });

        return response()->json([
            'ok' => true,
            'stats' => $this->statsSnapshot(),
        ]);
    }

    /**
     * @return array<int, string>
     */
    private function claimIds(): array
    {
        /** @var array<int, array{id: string}> $claims */
        $claims = Facts::json('fake-news-claims');

        return array_values(array_map(
            static fn (array $claim): string => (string) $claim['id'],
            $claims
        ));
    }

    /**
     * @return array{
     *     claims: array<string, array{true: int, false: int}>,
     *     scores: object,
     *     total_runs: int,
     *     average_score: float|null
     * }
     */
    private function statsSnapshot(): array
    {
        $claimIds = $this->claimIds();
        $maxScore = count($claimIds);

        $claimRows = DB::table('fake_news_claim_stats')
            ->get(['claim_id', 'true_count', 'false_count'])
            ->keyBy('claim_id');

        $claims = [];
        foreach ($claimIds as $claimId) {
            $row = $claimRows->get($claimId);
            $claims[$claimId] = [
                'true' => $row !== null ? (int) $row->true_count : 0,
                'false' => $row !== null ? (int) $row->false_count : 0,
            ];
        }

        $scoreRows = DB::table('fake_news_score_stats')
            ->get(['score', 'runs_count'])
            ->keyBy('score');

        $scores = [];
        $totalRuns = 0;
        $weightedSum = 0;

        for ($score = 0; $score <= $maxScore; $score++) {
            $row = $scoreRows->get($score);
            $runs = $row !== null ? (int) $row->runs_count : 0;
            $scores[(string) $score] = $runs;
            $totalRuns += $runs;
            $weightedSum += $score * $runs;
        }

        return [
            'claims' => $claims,
            'scores' => (object) $scores,
            'total_runs' => $totalRuns,
            'average_score' => $totalRuns > 0 ? round($weightedSum / $totalRuns, 2) : null,
        ];
    }
}
