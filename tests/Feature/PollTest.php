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

test('an authenticated user without polls.edit sees only active polls', function () {
    // Was 'authenticated user sees all polls', asserting that any signed-in
    // account saw unlaunched polls. Two problems with it. The boundary it drew
    // was "logged in" instead of "may moderate polls", contradicting /polls. And
    // it used a bare User::factory(), which defaults to role 'admin' — so it
    // passed through the admin wildcard and never tested the claim in its name.
    // role => 'user' is what makes this the test it says it is.
    Poll::factory()->create(['is_active' => true]);
    Poll::factory()->create(['is_active' => false]);

    $this->actingAs(User::factory()->create(['role' => 'user', 'permissions' => []]))
        ->getJson('/api/polls')
        ->assertOk()
        ->assertJsonCount(1);
});

test('a polls editor sees unlaunched polls in the json list', function () {
    Poll::factory()->create(['is_active' => true]);
    Poll::factory()->create(['is_active' => false]);

    $this->actingAs(User::factory()->create(['role' => 'user', 'permissions' => ['polls.edit']]))
        ->getJson('/api/polls')
        ->assertOk()
        ->assertJsonCount(2);
});

test('the json list and the page agree on who sees unlaunched polls', function () {
    // The two endpoints serve one list, so assert the agreement directly. They
    // disagreed until both used canViewInactive(). index() returns a bare array,
    // not a `data` envelope, hence assertJsonCount rather than ->json('data').
    Poll::factory()->create(['is_active' => true]);
    Poll::factory()->create(['is_active' => false]);

    // role pinned on both: the factory default is 'admin', which would make
    // this comparison vacuous.
    $reader = User::factory()->create(['role' => 'user', 'permissions' => []]);
    $editor = User::factory()->create(['role' => 'user', 'permissions' => ['polls.edit']]);

    $this->actingAs($reader)->getJson('/api/polls')->assertJsonCount(1);
    $this->actingAs($reader)->get('/polls')->assertInertia(
        fn ($page) => $page->component('Polls/Index')->count('polls', 1)
    );

    $this->actingAs($editor)->getJson('/api/polls')->assertJsonCount(2);
    $this->actingAs($editor)->get('/polls')->assertInertia(
        fn ($page) => $page->component('Polls/Index')->count('polls', 2)
    );
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
    // create poll is gated on polls.create by its route, so grant exactly that.
    $this->actingAs(User::factory()->withPermissions(['polls.create'])->create())
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

    // update poll is gated on polls.edit by its route, so grant exactly that.
    $this->actingAs(User::factory()->withPermissions(['polls.edit'])->create())
        ->putJson("/api/polls/{$poll->id}", ['title' => 'Updated'])
        ->assertOk()
        ->assertJsonPath('title', 'Updated');
});

test('authenticated user can delete poll', function () {
    $poll = Poll::factory()->create();

    // delete poll is gated on polls.delete by its route, so grant exactly that.
    $this->actingAs(User::factory()->withPermissions(['polls.delete'])->create())
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
