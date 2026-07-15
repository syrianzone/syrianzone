<?php

use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Models\Poll;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

function seedTierlistScores(int $firstScore, int $secondScore): array
{
    $poll = Poll::factory()->create(['slug' => 'best-ministers']);
    $group = CandidateGroup::factory()->create(['poll_id' => $poll->id, 'name' => 'الوزراء', 'key' => 'ministers']);
    $first = Candidate::factory()->create(['poll_id' => $poll->id, 'candidate_group_id' => $group->id, 'name' => 'الأول']);
    $second = Candidate::factory()->create(['poll_id' => $poll->id, 'candidate_group_id' => $group->id, 'name' => 'الثاني']);

    foreach ([[$first, $firstScore], [$second, $secondScore]] as [$candidate, $score]) {
        DB::table('daily_scores')->insert([
            'poll_id' => $poll->id,
            'candidate_id' => $candidate->id,
            'day' => now()->startOfDay(),
            'votes' => 1,
            'score' => $score,
            'updated_at' => now(),
        ]);
    }

    return [$poll, $first, $second];
}

test('first run records a baseline without posting', function () {
    [$poll] = seedTierlistScores(50, 40);
    Http::fake();

    $this->artisan('tierlist:post-rank-changes')->assertSuccessful();

    Http::assertNothingSent();
    $this->assertDatabaseCount('daily_ranks', 2);
    $this->assertDatabaseHas('daily_ranks', ['poll_id' => $poll->id, 'rank' => 1, 'score' => 50]);
});

test('posts each changed rank and checkpoints successful posts', function () {
    [$poll, $first, $second] = seedTierlistScores(50, 40);
    $day = now()->subDay()->startOfDay();
    DB::table('daily_ranks')->insert([
        ['poll_id' => $poll->id, 'candidate_id' => $first->id, 'day' => $day, 'rank' => 2, 'votes' => 1, 'score' => 40, 'created_at' => now()],
        ['poll_id' => $poll->id, 'candidate_id' => $second->id, 'day' => $day, 'rank' => 1, 'votes' => 1, 'score' => 50, 'created_at' => now()],
    ]);
    config(['services.x.access_token' => 'token']);
    Http::fake([
        'api.x.com/2/users/me' => Http::response(['data' => ['username' => 'syrianzone']]),
        'api.x.com/2/tweets' => Http::response(['data' => ['id' => '123']], 201),
    ]);

    $this->artisan('tierlist:post-rank-changes')->assertSuccessful();

    Http::assertSentCount(3);
    Http::assertSent(fn ($request) => $request->url() === 'https://api.x.com/2/tweets'
        && str_contains($request['text'], 'الأول')
        && str_contains($request['text'], '2 ← 1'));
    $this->assertDatabaseHas('daily_ranks', ['candidate_id' => $first->id, 'day' => now()->startOfDay(), 'rank' => 1]);
    $this->assertDatabaseHas('daily_ranks', ['candidate_id' => $second->id, 'day' => now()->startOfDay(), 'rank' => 2]);
});

test('dry run reports changes without posting or checkpointing them', function () {
    [$poll, $first, $second] = seedTierlistScores(50, 40);
    $day = now()->subDay()->startOfDay();
    DB::table('daily_ranks')->insert([
        ['poll_id' => $poll->id, 'candidate_id' => $first->id, 'day' => $day, 'rank' => 2, 'votes' => 1, 'score' => 40, 'created_at' => now()],
        ['poll_id' => $poll->id, 'candidate_id' => $second->id, 'day' => $day, 'rank' => 1, 'votes' => 1, 'score' => 50, 'created_at' => now()],
    ]);
    Http::fake();

    $this->artisan('tierlist:post-rank-changes --dry-run')->assertSuccessful();

    Http::assertNothingSent();
    $this->assertDatabaseMissing('daily_ranks', ['candidate_id' => $first->id, 'day' => now()->startOfDay()]);
});

test('failed posts remain pending for a later retry', function () {
    [$poll, $first, $second] = seedTierlistScores(50, 40);
    $day = now()->subDay()->startOfDay();
    DB::table('daily_ranks')->insert([
        ['poll_id' => $poll->id, 'candidate_id' => $first->id, 'day' => $day, 'rank' => 2, 'votes' => 1, 'score' => 40, 'created_at' => now()],
        ['poll_id' => $poll->id, 'candidate_id' => $second->id, 'day' => $day, 'rank' => 1, 'votes' => 1, 'score' => 50, 'created_at' => now()],
    ]);
    config(['services.x.access_token' => 'token']);
    Http::fake([
        'api.x.com/2/users/me' => Http::response(['data' => ['username' => 'syrianzone']]),
        'api.x.com/2/tweets' => Http::response(['detail' => 'nope'], 500),
    ]);

    $this->artisan('tierlist:post-rank-changes')->assertFailed();

    $this->assertDatabaseMissing('daily_ranks', ['candidate_id' => $first->id, 'day' => now()->startOfDay()]);
});

test('refuses to post from an access token for another account', function () {
    [$poll, $first, $second] = seedTierlistScores(50, 40);
    $day = now()->subDay()->startOfDay();
    DB::table('daily_ranks')->insert([
        ['poll_id' => $poll->id, 'candidate_id' => $first->id, 'day' => $day, 'rank' => 2, 'votes' => 1, 'score' => 40, 'created_at' => now()],
        ['poll_id' => $poll->id, 'candidate_id' => $second->id, 'day' => $day, 'rank' => 1, 'votes' => 1, 'score' => 50, 'created_at' => now()],
    ]);
    config(['services.x.access_token' => 'token', 'services.x.username' => 'syrianzone']);
    Http::fake(['api.x.com/2/users/me' => Http::response(['data' => ['username' => 'personal_account']])]);

    $this->artisan('tierlist:post-rank-changes')->assertFailed();

    Http::assertNotSent(fn ($request) => $request->url() === 'https://api.x.com/2/tweets');
});
