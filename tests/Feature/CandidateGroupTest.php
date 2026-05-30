<?php

use App\Models\CandidateGroup;
use App\Models\Poll;
use App\Models\User;

test('can list groups for poll', function () {
    $poll = Poll::factory()->create();
    CandidateGroup::factory()->count(3)->create(['poll_id' => $poll->id]);

    $this->actingAs(User::factory()->create())
        ->getJson("/api/candidate-groups?poll_id={$poll->id}")
        ->assertOk()
        ->assertJsonCount(3);
});

test('can create group', function () {
    $poll = Poll::factory()->create();

    $this->actingAs(User::factory()->create())
        ->postJson('/api/candidate-groups', ['poll_id' => $poll->id, 'name' => 'Ministers'])
        ->assertCreated()
        ->assertJsonPath('name', 'Ministers');
});

test('can show group', function () {
    $group = CandidateGroup::factory()->create();

    $this->actingAs(User::factory()->create())
        ->getJson("/api/candidate-groups/{$group->id}")
        ->assertOk()
        ->assertJsonPath('id', $group->id);
});

test('can update group', function () {
    $group = CandidateGroup::factory()->create();

    $this->actingAs(User::factory()->create())
        ->putJson("/api/candidate-groups/{$group->id}", ['name' => 'Governors'])
        ->assertOk()
        ->assertJsonPath('name', 'Governors');
});

test('can delete group', function () {
    $group = CandidateGroup::factory()->create();

    $this->actingAs(User::factory()->create())
        ->deleteJson("/api/candidate-groups/{$group->id}")
        ->assertOk();

    $this->assertDatabaseMissing('candidate_groups', ['id' => $group->id]);
});

test('can reorder groups', function () {
    $poll = Poll::factory()->create();
    $g1 = CandidateGroup::factory()->create(['poll_id' => $poll->id, 'sort_order' => 0]);
    $g2 = CandidateGroup::factory()->create(['poll_id' => $poll->id, 'sort_order' => 1]);

    $this->actingAs(User::factory()->create())
        ->postJson('/api/candidate-groups/reorder', [
            'groups' => [
                ['id' => $g1->id, 'sort_order' => 1],
                ['id' => $g2->id, 'sort_order' => 0],
            ],
        ])->assertOk();

    expect($g1->fresh()->sort_order)->toBe(1);
    expect($g2->fresh()->sort_order)->toBe(0);
});

test('can set default group', function () {
    $poll = Poll::factory()->create();
    $g1 = CandidateGroup::factory()->create(['poll_id' => $poll->id, 'is_default' => true]);
    $g2 = CandidateGroup::factory()->create(['poll_id' => $poll->id, 'is_default' => false]);

    $this->actingAs(User::factory()->create())
        ->postJson("/api/candidate-groups/{$g2->id}/default")
        ->assertOk();

    expect($g1->fresh()->is_default)->toBeFalse();
    expect($g2->fresh()->is_default)->toBeTrue();
});
