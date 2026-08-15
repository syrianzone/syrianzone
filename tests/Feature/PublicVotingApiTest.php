<?php

use App\Models\Ballot;
use App\Models\BallotItem;
use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Models\DailyScore;
use App\Models\Poll;
use App\Models\User;

test('lists only active polls without user_id', function () {
    $user = User::factory()->create();
    Poll::factory()->create(['is_active' => true, 'user_id' => $user->id, 'slug' => 'visible']);
    Poll::factory()->create(['is_active' => false, 'slug' => 'hidden']);

    $response = $this->getJson('/api/v1/polls')->assertOk()->assertJsonCount(1);

    expect($response->json('0.slug'))->toBe('visible');
    expect($response->json('0'))->not->toHaveKey('user_id');
});

test('shows poll with groups and candidates by slug or id', function () {
    $poll = Poll::factory()->create(['slug' => 'test-poll']);
    $group = CandidateGroup::factory()->create(['poll_id' => $poll->id]);
    Candidate::factory()->create(['poll_id' => $poll->id, 'candidate_group_id' => $group->id]);

    $this->getJson('/api/v1/polls/test-poll')
        ->assertOk()
        ->assertJsonPath('poll.slug', 'test-poll')
        ->assertJsonCount(1, 'groups')
        ->assertJsonCount(1, 'candidates');

    $this->getJson("/api/v1/polls/{$poll->id}")
        ->assertOk()
        ->assertJsonPath('poll.id', $poll->id);
});

test('unknown poll returns 404', function () {
    $this->getJson('/api/v1/polls/does-not-exist')->assertNotFound();
});

test('candidates can be filtered by status', function () {
    $poll = Poll::factory()->create(['slug' => 'test-poll']);
    Candidate::factory()->create(['poll_id' => $poll->id, 'status' => 'active']);
    Candidate::factory()->create(['poll_id' => $poll->id, 'status' => 'archived']);

    $this->getJson('/api/v1/polls/test-poll/candidates')->assertOk()->assertJsonCount(2);
    $this->getJson('/api/v1/polls/test-poll/candidates?status=active')->assertOk()->assertJsonCount(1);
    $this->getJson('/api/v1/polls/test-poll/candidates?status=archived')->assertOk()->assertJsonCount(1);
});

test('scores are scoped to the poll and filterable by date and candidate', function () {
    $poll = Poll::factory()->create(['slug' => 'test-poll']);
    $otherPoll = Poll::factory()->create();
    $a = Candidate::factory()->create(['poll_id' => $poll->id]);
    $b = Candidate::factory()->create(['poll_id' => $poll->id]);
    $other = Candidate::factory()->create(['poll_id' => $otherPoll->id]);

    DailyScore::create(['poll_id' => $poll->id, 'candidate_id' => $a->id, 'day' => '2026-08-01', 'votes' => 5, 'score' => 20]);
    DailyScore::create(['poll_id' => $poll->id, 'candidate_id' => $a->id, 'day' => '2026-08-02', 'votes' => 3, 'score' => 12]);
    DailyScore::create(['poll_id' => $poll->id, 'candidate_id' => $b->id, 'day' => '2026-08-01', 'votes' => 2, 'score' => 4]);
    DailyScore::create(['poll_id' => $otherPoll->id, 'candidate_id' => $other->id, 'day' => '2026-08-01', 'votes' => 9, 'score' => 9]);

    $this->getJson('/api/v1/polls/test-poll/scores')
        ->assertOk()
        ->assertJsonCount(3, 'data');

    $this->getJson('/api/v1/polls/test-poll/scores?from=2026-08-02')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.candidate_id', $a->id);

    $this->getJson("/api/v1/polls/test-poll/scores?candidate_id={$a->id}")
        ->assertOk()
        ->assertJsonCount(2, 'data');
});

test('ballots exclude voter identifiers but include tier items', function () {
    $poll = Poll::factory()->create(['slug' => 'test-poll']);
    $candidate = Candidate::factory()->create(['poll_id' => $poll->id]);
    $ballot = Ballot::create([
        'poll_id' => $poll->id,
        'vote_day' => '2026-08-01 00:00:00',
        'voter_key' => hash('sha256', 'device-secret'),
        'ip_hash' => hash('sha256', '1.2.3.4'),
        'user_agent' => 'Mozilla/5.0 secret agent',
    ]);
    BallotItem::create(['ballot_id' => $ballot->id, 'candidate_id' => $candidate->id, 'tier' => 'S', 'position' => 0]);

    $response = $this->getJson('/api/v1/polls/test-poll/ballots')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.items.0.tier', 'S')
        ->assertJsonPath('data.0.items.0.candidate_id', $candidate->id);

    $row = $response->json('data.0');
    expect($row)->not->toHaveKeys(['voter_key', 'ip_hash', 'user_agent']);
    expect(json_encode($response->json()))
        ->not->toContain(hash('sha256', 'device-secret'))
        ->not->toContain(hash('sha256', '1.2.3.4'))
        ->not->toContain('secret agent');
});

test('per_page is capped at 1000', function () {
    $poll = Poll::factory()->create(['slug' => 'test-poll']);

    $this->getJson('/api/v1/polls/test-poll/ballots?per_page=5000')
        ->assertOk()
        ->assertJsonPath('per_page', 1000);

    $this->getJson('/api/v1/polls/test-poll/scores?per_page=0')
        ->assertOk()
        ->assertJsonPath('per_page', 1);
});

test('public api is rate limited', function () {
    Poll::factory()->create(['slug' => 'test-poll']);

    foreach (range(1, 60) as $i) {
        $this->getJson('/api/v1/polls')->assertOk();
    }
    $this->getJson('/api/v1/polls')->assertStatus(429);
});
