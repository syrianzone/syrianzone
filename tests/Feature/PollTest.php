<?php

use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Models\Poll;
use App\Models\User;

test('can list active polls', function () {
    Poll::factory()->create(['is_active' => true]);
    Poll::factory()->create(['is_active' => false]);

    $this->getJson('/api/polls')->assertOk()->assertJsonCount(1);
});

test('authenticated user sees all polls', function () {
    Poll::factory()->create(['is_active' => true]);
    Poll::factory()->create(['is_active' => false]);

    $this->actingAs(User::factory()->create())
        ->getJson('/api/polls')
        ->assertOk()
        ->assertJsonCount(2);
});

test('can show poll by slug', function () {
    $poll = Poll::factory()->create(['slug' => 'test-poll']);

    $this->getJson('/api/polls/test-poll')
        ->assertOk()
        ->assertJsonPath('poll.slug', 'test-poll');
});

test('can show poll by id', function () {
    $poll = Poll::factory()->create();

    $this->getJson("/api/polls/{$poll->id}")
        ->assertOk()
        ->assertJsonPath('poll.id', $poll->id);
});

test('authenticated user can create poll', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/polls', ['title' => 'New Poll', 'slug' => 'new-poll'])
        ->assertCreated()
        ->assertJsonPath('slug', 'new-poll');

    $this->assertDatabaseHas('polls', ['slug' => 'new-poll']);
});

test('unauthenticated user cannot create poll', function () {
    $this->postJson('/api/polls', ['title' => 'New Poll', 'slug' => 'new-poll'])
        ->assertUnauthorized();
});

test('authenticated user can update poll', function () {
    $poll = Poll::factory()->create();

    $this->actingAs(User::factory()->create())
        ->putJson("/api/polls/{$poll->id}", ['title' => 'Updated'])
        ->assertOk()
        ->assertJsonPath('title', 'Updated');
});

test('authenticated user can delete poll', function () {
    $poll = Poll::factory()->create();

    $this->actingAs(User::factory()->create())
        ->deleteJson("/api/polls/{$poll->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('polls', ['id' => $poll->id]);
});

test('can get leaderboard', function () {
    $poll = Poll::factory()->create(['slug' => 'test']);
    $group = CandidateGroup::factory()->create(['poll_id' => $poll->id, 'key' => 'ministers']);
    Candidate::factory()->create(['poll_id' => $poll->id, 'candidate_group_id' => $group->id]);

    $this->getJson('/api/polls/test/leaderboard')
        ->assertOk()
        ->assertJsonPath('poll.slug', 'test');
});

test('can submit vote', function () {
    $poll = Poll::factory()->create(['slug' => 'test']);
    $candidate1 = Candidate::factory()->create(['poll_id' => $poll->id]);
    $candidate2 = Candidate::factory()->create(['poll_id' => $poll->id]);
    $candidate3 = Candidate::factory()->create(['poll_id' => $poll->id]);

    $this->postJson('/api/submit', [
        'pollSlug' => 'test',
        'deviceId' => 'test-device-123',
        'tiers' => [
            'S' => [['candidateId' => $candidate1->id, 'pos' => 0]],
            'A' => [['candidateId' => $candidate2->id, 'pos' => 0]],
            'B' => [['candidateId' => $candidate3->id, 'pos' => 0]],
        ],
    ])->assertOk()->assertJsonPath('ok', true);

    $this->assertDatabaseHas('ballots', ['poll_id' => $poll->id]);
});

test('vote requires minimum 3 selections', function () {
    $poll = Poll::factory()->create(['slug' => 'test']);
    $candidate = Candidate::factory()->create(['poll_id' => $poll->id]);

    $this->postJson('/api/submit', [
        'pollSlug' => 'test',
        'deviceId' => 'test-device-123',
        'tiers' => ['S' => [['candidateId' => $candidate->id]]],
    ])->assertStatus(400);
});

test('voting is rate limited', function () {
    $poll = Poll::factory()->create(['slug' => 'test']);
    $candidate1 = Candidate::factory()->create(['poll_id' => $poll->id]);
    $candidate2 = Candidate::factory()->create(['poll_id' => $poll->id]);
    $candidate3 = Candidate::factory()->create(['poll_id' => $poll->id]);
    $payload = [
        'pollSlug' => 'test',
        'deviceId' => 'device',
        'tiers' => [
            'S' => [['candidateId' => $candidate1->id, 'pos' => 0]],
            'A' => [['candidateId' => $candidate2->id, 'pos' => 0]],
            'B' => [['candidateId' => $candidate3->id, 'pos' => 0]],
        ],
    ];

    for ($i = 0; $i < 11; $i++) {
        $payload['deviceId'] = "device-{$i}";
        $response = $this->postJson('/api/submit', $payload);
    }

    $response->assertStatus(429)->assertJsonPath('error', 'Too many votes. Please slow down.');
});
