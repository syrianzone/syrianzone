<?php

use App\Models\Ballot;
use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Models\Contribution;
use App\Models\Contributor;
use App\Models\Poll;
use App\Models\User;

test('poll has many candidates', function () {
    $poll = Poll::factory()->create();
    Candidate::factory()->count(3)->create(['poll_id' => $poll->id]);

    expect($poll->candidates)->toHaveCount(3);
});

test('poll has many groups', function () {
    $poll = Poll::factory()->create();
    CandidateGroup::factory()->count(2)->create(['poll_id' => $poll->id]);

    expect($poll->groups)->toHaveCount(2);
});

test('poll has many ballots', function () {
    $poll = Poll::factory()->create();
    Ballot::create(['poll_id' => $poll->id, 'vote_day' => now(), 'voter_key' => 'k1', 'ip_hash' => 'h1']);
    Ballot::create(['poll_id' => $poll->id, 'vote_day' => now(), 'voter_key' => 'k2', 'ip_hash' => 'h2']);

    expect($poll->ballots)->toHaveCount(2);
});

test('candidate belongs to poll', function () {
    $poll = Poll::factory()->create();
    $candidate = Candidate::factory()->create(['poll_id' => $poll->id]);

    expect($candidate->poll->id)->toBe($poll->id);
});

test('candidate belongs to group', function () {
    $poll = Poll::factory()->create();
    $group = CandidateGroup::factory()->create(['poll_id' => $poll->id]);
    $candidate = Candidate::factory()->create(['poll_id' => $poll->id, 'candidate_group_id' => $group->id]);

    expect($candidate->group->id)->toBe($group->id);
});

test('group has many candidates', function () {
    $poll = Poll::factory()->create();
    $group = CandidateGroup::factory()->create(['poll_id' => $poll->id]);
    Candidate::factory()->count(4)->create(['poll_id' => $poll->id, 'candidate_group_id' => $group->id]);

    expect($group->candidates)->toHaveCount(4);
});

test('contributor has many contributions', function () {
    $contributor = Contributor::factory()->create();
    Contribution::create([
        'contributor_id' => $contributor->id,
        'type' => 'PR',
        'repository' => 'test/repo',
        'date' => now(),
    ]);

    expect($contributor->contributions)->toHaveCount(1);
});

test('user is superadmin', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $superadmin = User::factory()->create(['role' => 'superadmin']);

    expect($admin->isSuperAdmin())->toBeFalse();
    expect($superadmin->isSuperAdmin())->toBeTrue();
});
