<?php

use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Models\DailyScore;
use App\Models\Poll;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

test('both poll readers expose the real ballot scores for the poll local day', function (string $timezone, string $storage) {
    $this->travelTo(Carbon::parse('2026-11-15T22:30:00Z'));
    $poll = Poll::factory()->create(['timezone' => $timezone]);
    $group = CandidateGroup::factory()->create(['poll_id' => $poll->id, 'is_active' => true]);
    $candidates = Candidate::factory()->count(3)->create([
        'poll_id' => $poll->id, 'candidate_group_id' => $group->id, 'status' => 'active',
    ]);
    $today = Carbon::now($poll->safeTimezone())->startOfDay();

    $this->postJson("/api/v1/polls/{$poll->slug}/ballots", [
        'deviceId' => 'native-score-date-regression',
        'tiers' => ['S' => $candidates->values()->map(fn ($candidate, $index) => [
            'candidateId' => $candidate->id, 'pos' => $index,
        ])->all()],
    ])->assertOk()->assertJsonPath('ok', true);

    // Preserve both the service's raw date-only upsert and the model's datetime storage contract.
    $scores = DB::table('daily_scores')->where('poll_id', $poll->id)->get();
    expect($scores)->toHaveCount(3);
    if ($storage === 'model midnight') {
        DB::table('daily_scores')->where('poll_id', $poll->id)->delete();
        foreach ($scores as $score) {
            DailyScore::create([
                'poll_id' => $poll->id, 'candidate_id' => $score->candidate_id, 'day' => $today,
                'votes' => $score->votes, 'score' => $score->score,
            ]);
        }
    }
    if (DB::getDriverName() === 'sqlite') {
        expect(DB::table('daily_scores')->where('poll_id', $poll->id)->pluck('day')->unique()->all())
            ->toBe([$storage === 'model midnight' ? $today->toDateTimeString() : $today->toDateString()]);
    }
    DB::table('daily_scores')->insert([
        'poll_id' => $poll->id, 'candidate_id' => $candidates[0]->id,
        'day' => $today->copy()->subDay()->toDateString(), 'votes' => 9, 'score' => 999,
    ]);
    DailyScore::create([
        'poll_id' => $poll->id, 'candidate_id' => $candidates[0]->id,
        'day' => $today->copy()->addDay(), 'votes' => 9, 'score' => 999,
    ]);
    $otherPoll = Poll::factory()->create();
    $otherCandidate = Candidate::factory()->create(['poll_id' => $otherPoll->id]);
    DB::table('daily_scores')->insert([
        'poll_id' => $otherPoll->id, 'candidate_id' => $otherCandidate->id,
        'day' => $today->toDateString(), 'votes' => 9, 'score' => 999,
    ]);

    $editor = User::factory()->withPermissions(['polls.edit'])->create();
    $admin = $this->actingAs($editor)->getJson("/api/v1/admin/polls/{$poll->id}?include_archived=1");
    $this->app['auth']->forgetGuards();
    $this->assertGuest();
    $legacy = $this->getJson("/api/polls/{$poll->slug}");
    foreach ([$admin, $legacy] as $response) {
        $response->assertOk()->assertJsonCount(3, 'todayScores')
            ->assertJsonPath('voteDay', $today->toIso8601String());
        expect(collect($response->json('todayScores'))->pluck('candidate_id')->sort()->values()->all())
            ->toBe($candidates->pluck('id')->sort()->values()->all());
        foreach ($response->json('todayScores') as $score) {
            expect($score['poll_id'])->toBe($poll->id)
                ->and($score['votes'])->toBe(1)
                ->and($score['score'])->toBeGreaterThan(0);
        }
    }
})->with([
    'Damascus service date' => ['Asia/Damascus', 'service date'],
    'Damascus model midnight' => ['Asia/Damascus', 'model midnight'],
    'Los Angeles service date' => ['America/Los_Angeles', 'service date'],
    'Los Angeles model midnight' => ['America/Los_Angeles', 'model midnight'],
]);
