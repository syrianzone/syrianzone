<?php

use App\Models\Candidate;
use App\Models\Poll;
use App\Services\VotingService;

test('creates ballot and ballot items', function () {
    $poll = Poll::factory()->create();
    $c1 = Candidate::factory()->create(['poll_id' => $poll->id]);
    $c2 = Candidate::factory()->create(['poll_id' => $poll->id]);

    $service = new VotingService();
    $service->submit($poll, [
        'S' => [['candidateId' => $c1->id, 'pos' => 0]],
        'A' => [['candidateId' => $c2->id, 'pos' => 0]],
        'B' => [['candidateId' => $c1->id, 'pos' => 0]],
    ], 'voter-key', 'ip-hash', 'user-agent');

    $this->assertDatabaseHas('ballots', ['poll_id' => $poll->id, 'voter_key' => 'voter-key']);
    $this->assertDatabaseCount('ballot_items', 3);
});

test('calculates correct score for S tier first position', function () {
    $poll = Poll::factory()->create();
    $candidate = Candidate::factory()->create(['poll_id' => $poll->id]);

    $service = new VotingService();
    $service->submit($poll, [
        'S' => [['candidateId' => $candidate->id, 'pos' => 0]],
        'A' => [['candidateId' => $candidate->id, 'pos' => 0]],
        'B' => [['candidateId' => $candidate->id, 'pos' => 0]],
    ], 'key', 'ip', null);

    $this->assertDatabaseHas('daily_scores', [
        'candidate_id' => $candidate->id,
        'votes' => 3,
        'score' => 55 + 44 + 33,
    ]);
});

test('accumulates daily scores', function () {
    $poll = Poll::factory()->create();
    $candidate = Candidate::factory()->create(['poll_id' => $poll->id]);

    $service = new VotingService();
    $service->submit($poll, [
        'S' => [['candidateId' => $candidate->id]],
        'A' => [['candidateId' => $candidate->id]],
        'B' => [['candidateId' => $candidate->id]],
    ], 'key1', 'ip1', null);

    $service->submit($poll, [
        'S' => [['candidateId' => $candidate->id]],
        'A' => [['candidateId' => $candidate->id]],
        'B' => [['candidateId' => $candidate->id]],
    ], 'key2', 'ip2', null);

    $this->assertDatabaseHas('daily_scores', [
        'candidate_id' => $candidate->id,
        'votes' => 6,
    ]);
});

test('applies position bonus correctly', function () {
    $poll = Poll::factory()->create();
    $c1 = Candidate::factory()->create(['poll_id' => $poll->id]);
    $c2 = Candidate::factory()->create(['poll_id' => $poll->id]);
    $c3 = Candidate::factory()->create(['poll_id' => $poll->id]);

    $service = new VotingService();
    $service->submit($poll, [
        'S' => [
            ['candidateId' => $c1->id, 'pos' => 0],
            ['candidateId' => $c2->id, 'pos' => 1],
            ['candidateId' => $c3->id, 'pos' => 2],
        ],
    ], 'key', 'ip', null);

    $this->assertDatabaseHas('daily_scores', ['candidate_id' => $c1->id, 'score' => 55]);
    $this->assertDatabaseHas('daily_scores', ['candidate_id' => $c2->id, 'score' => 53]);
    $this->assertDatabaseHas('daily_scores', ['candidate_id' => $c3->id, 'score' => 51]);
});
