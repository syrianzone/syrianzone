<?php

use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Models\Poll;
use App\Models\User;
use Carbon\Carbon;

function mobilePollBearer(User $user, array $abilities = ['mobile'], string $name = 'mobile:test'): string
{
    return $user->createToken($name, $abilities)->plainTextToken;
}

function mobilePollBallot(array $candidateIds, string $installationId = 'install-12345678'): array
{
    return [
        'installationId' => $installationId,
        'tiers' => [
            'S' => [['candidateId' => $candidateIds[0], 'pos' => 0]],
            'A' => [['candidateId' => $candidateIds[1], 'pos' => 0]],
            'B' => [['candidateId' => $candidateIds[2], 'pos' => 0]],
        ],
    ];
}

test('mobile poll listing exposes only active polls with a bounded contract', function () {
    $active = Poll::factory()->create(['title' => 'Active poll']);
    Poll::factory()->create(['is_active' => false, 'title' => 'Hidden poll']);

    $this->getJson('/api/mobile/polls')
        ->assertOk()
        ->assertExactJson([
            'data' => [[
                'id' => $active->id,
                'isActive' => true,
                'slug' => $active->slug,
                'timezone' => 'UTC',
                'title' => 'Active poll',
            ]],
        ]);
});

test('mobile poll detail is active only and omits archived candidates', function () {
    Carbon::setTestNow('2026-07-15 22:30:00 UTC');
    $poll = Poll::factory()->create(['slug' => 'cabinet', 'timezone' => 'Asia/Damascus']);
    $group = CandidateGroup::factory()->create([
        'poll_id' => $poll->id,
        'is_default' => true,
        'key' => 'minister',
        'name' => 'الوزراء',
    ]);
    $active = Candidate::factory()->create([
        'candidate_group_id' => $group->id,
        'image_url' => '/images/minister.png',
        'name' => 'مرشح نشط',
        'poll_id' => $poll->id,
        'sort' => 2,
        'status' => 'active',
    ]);
    Candidate::factory()->create([
        'candidate_group_id' => $group->id,
        'poll_id' => $poll->id,
        'sort' => 1,
        'status' => 'archived',
    ]);

    $this->getJson('/api/mobile/polls/cabinet?include_archived=1')
        ->assertOk()
        ->assertJsonCount(1, 'data.candidates')
        ->assertJsonPath('data.candidates.0.id', $active->id)
        ->assertJsonPath('data.candidates.0.groupId', $group->id)
        ->assertJsonPath('data.candidates.0.imageUrl', '/images/minister.png')
        ->assertJsonPath('data.groups.0.isDefault', true)
        ->assertJsonPath('data.voteDay', '2026-07-16');

    $inactive = Poll::factory()->create(['is_active' => false]);
    $this->getJson("/api/mobile/polls/{$inactive->slug}")->assertNotFound();
});

test('mobile leaderboard returns dynamic group rankings and bounded history', function () {
    $poll = Poll::factory()->create(['slug' => 'rank-us']);
    $group = CandidateGroup::factory()->create([
        'poll_id' => $poll->id,
        'key' => 'minister',
        'name' => 'الوزراء',
    ]);
    $candidate = Candidate::factory()->create([
        'candidate_group_id' => $group->id,
        'name' => 'الأول',
        'poll_id' => $poll->id,
    ]);
    DB::table('daily_scores')->insert([
        'candidate_id' => $candidate->id,
        'day' => '2026-07-14',
        'poll_id' => $poll->id,
        'score' => 110,
        'updated_at' => now(),
        'votes' => 2,
    ]);

    $this->getJson('/api/mobile/polls/rank-us/leaderboard?status=nonsense')
        ->assertOk()
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.rankings.ministers.0.candidateId', $candidate->id)
        ->assertJsonPath('data.rankings.ministers.0.rank', 1)
        ->assertJsonPath('data.rankings.ministers.0.avg', 55)
        ->assertJsonPath("data.history.{$candidate->id}.0.date", '2026-07-14')
        ->assertJsonMissingPath('data.rankings.ministers.0.created_at');
});

test('mobile voting accepts one valid installation ballot per poll day', function () {
    Carbon::setTestNow('2026-07-15 12:00:00 UTC');
    $poll = Poll::factory()->create(['slug' => 'daily-vote']);
    $candidates = Candidate::factory()->count(3)->create(['poll_id' => $poll->id]);
    $payload = mobilePollBallot($candidates->pluck('id')->all());

    $this->withHeader('User-Agent', 'SyrianZone/1.0 (iOS)')
        ->postJson('/api/mobile/polls/daily-vote/votes', $payload)
        ->assertCreated()
        ->assertExactJson([
            'data' => [
                'accepted' => true,
                'voteDay' => '2026-07-15',
            ],
        ]);

    $this->assertDatabaseCount('ballots', 1);
    $this->assertDatabaseCount('ballot_items', 3);
    $this->assertDatabaseHas('mobile_poll_vote_receipts', [
        'installation_hash' => hash('sha256', 'install-12345678'),
        'poll_id' => $poll->id,
        'vote_day' => '2026-07-15',
    ]);
    $this->assertDatabaseHas('daily_scores', [
        'candidate_id' => $candidates[0]->id,
        'score' => 55,
        'votes' => 1,
    ]);
    $this->assertDatabaseHas('ballots', [
        'ip_hash' => hash_hmac('sha256', '127.0.0.1', config('app.key')),
        'user_agent' => hash_hmac('sha256', 'SyrianZone/1.0 (iOS)', config('app.key')),
    ]);

    $this->postJson('/api/mobile/polls/daily-vote/votes', $payload)
        ->assertConflict()
        ->assertExactJson([
            'code' => 'already_voted_today',
            'message' => 'تم تسجيل تصويت من هذا الجهاز لهذا الاستطلاع اليوم.',
        ]);

    $this->assertDatabaseCount('ballots', 1);
    $this->assertDatabaseHas('daily_scores', [
        'candidate_id' => $candidates[0]->id,
        'score' => 55,
        'votes' => 1,
    ]);
});

test('mobile voting bounds installation rotation from one network', function () {
    config(['mobile-polls.max_ballots_per_network_per_day' => 2]);
    $poll = Poll::factory()->create(['slug' => 'network-bounded-vote']);
    $candidates = Candidate::factory()->count(3)->create(['poll_id' => $poll->id]);
    $candidateIds = $candidates->pluck('id')->all();

    foreach (['network-installation-1', 'network-installation-2'] as $installationId) {
        $this->postJson(
            '/api/mobile/polls/network-bounded-vote/votes',
            mobilePollBallot($candidateIds, $installationId),
        )->assertCreated();
    }

    $this->postJson(
        '/api/mobile/polls/network-bounded-vote/votes',
        mobilePollBallot($candidateIds, 'network-installation-3'),
    )->assertTooManyRequests()->assertExactJson([
        'code' => 'network_vote_limit_reached',
        'message' => 'تم بلوغ حد الحماية من إساءة الاستخدام لهذه الشبكة اليوم.',
    ]);

    $this->assertDatabaseCount('ballots', 2);
});

test('mobile voting strictly validates the ballot against its active poll', function () {
    $poll = Poll::factory()->create(['slug' => 'strict-vote']);
    $candidates = Candidate::factory()->count(3)->create(['poll_id' => $poll->id]);
    $other = Candidate::factory()->create();
    $archived = Candidate::factory()->create([
        'poll_id' => $poll->id,
        'status' => 'archived',
    ]);

    $unknownTier = mobilePollBallot($candidates->pluck('id')->all());
    $unknownTier['tiers']['X'] = $unknownTier['tiers']['B'];
    unset($unknownTier['tiers']['B']);
    $this->postJson('/api/mobile/polls/strict-vote/votes', $unknownTier)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('tiers');

    $foreignCandidate = mobilePollBallot([
        $candidates[0]->id,
        $candidates[1]->id,
        $other->id,
    ], 'foreign-12345678');
    $this->postJson('/api/mobile/polls/strict-vote/votes', $foreignCandidate)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('tiers');

    $archivedCandidate = mobilePollBallot([
        $candidates[0]->id,
        $candidates[1]->id,
        $archived->id,
    ], 'archived-12345678');
    $this->postJson('/api/mobile/polls/strict-vote/votes', $archivedCandidate)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('tiers');

    $duplicate = mobilePollBallot([
        $candidates[0]->id,
        $candidates[1]->id,
        $candidates[0]->id,
    ], 'duplicate-12345678');
    $this->postJson('/api/mobile/polls/strict-vote/votes', $duplicate)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('tiers');

    $invalidPosition = mobilePollBallot($candidates->pluck('id')->all(), 'position-12345678');
    $invalidPosition['tiers']['S'][0]['pos'] = -1;
    $this->postJson('/api/mobile/polls/strict-vote/votes', $invalidPosition)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('tiers.S.0.pos');

    $inactive = Poll::factory()->create(['is_active' => false, 'slug' => 'closed-vote']);
    $closedCandidates = Candidate::factory()->count(3)->create(['poll_id' => $inactive->id]);
    $this->postJson(
        '/api/mobile/polls/closed-vote/votes',
        mobilePollBallot($closedCandidates->pluck('id')->all(), 'closed-12345678'),
    )->assertNotFound();

    $this->assertDatabaseCount('ballots', 0);
});

test('admin mobile poll listing requires a valid mobile bearer and admin role', function () {
    $active = Poll::factory()->create();
    $inactive = Poll::factory()->create(['is_active' => false]);
    $admin = User::factory()->create(['role' => 'admin']);
    $nonAdmin = User::factory()->create(['role' => 'transit_admin']);

    $this->getJson('/api/mobile/admin/polls')->assertUnauthorized();

    $this->withToken(mobilePollBearer($admin, ['*'], 'web:test'))
        ->getJson('/api/mobile/admin/polls')
        ->assertUnauthorized();

    $this->withToken(mobilePollBearer($nonAdmin))
        ->getJson('/api/mobile/admin/polls')
        ->assertForbidden();

    $this->withToken(mobilePollBearer($admin))
        ->getJson('/api/mobile/admin/polls')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonFragment(['id' => $active->id, 'isActive' => true])
        ->assertJsonFragment(['id' => $inactive->id, 'isActive' => false]);
});
