<?php

use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Models\Poll;
use App\Models\User;

test('authenticated user can create candidate', function () {
    $poll = Poll::factory()->create();

    $this->actingAs(User::factory()->create())
        ->postJson('/api/candidates', ['poll_id' => $poll->id, 'name' => 'John Doe'])
        ->assertCreated()
        ->assertJsonPath('name', 'John Doe');
});

test('unauthenticated user cannot create candidate', function () {
    $poll = Poll::factory()->create();

    $this->postJson('/api/candidates', ['poll_id' => $poll->id, 'name' => 'John'])
        ->assertUnauthorized();
});

test('authenticated user can update candidate', function () {
    $candidate = Candidate::factory()->create();

    $this->actingAs(User::factory()->create())
        ->putJson("/api/candidates/{$candidate->id}", ['name' => 'Jane Doe'])
        ->assertOk()
        ->assertJsonPath('name', 'Jane Doe');
});

test('authenticated user can delete candidate', function () {
    $candidate = Candidate::factory()->create();

    $this->actingAs(User::factory()->create())
        ->deleteJson("/api/candidates/{$candidate->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('candidates', ['id' => $candidate->id]);
});

test('can assign candidate to group', function () {
    $poll = Poll::factory()->create();
    $group = CandidateGroup::factory()->create(['poll_id' => $poll->id]);
    $candidate = Candidate::factory()->create(['poll_id' => $poll->id]);

    $this->actingAs(User::factory()->create())
        ->putJson("/api/candidates/{$candidate->id}", ['candidate_group_id' => $group->id])
        ->assertOk()
        ->assertJsonPath('candidate_group_id', $group->id);
});
