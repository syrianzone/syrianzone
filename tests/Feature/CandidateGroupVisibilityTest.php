<?php

use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Models\DailyScore;
use App\Models\Poll;
use App\Models\User;
use App\Services\TierlistLeaderboard;

/**
 * A disabled category (candidate group) is the non-destructive alternative to
 * deleting one: its row, candidates, images and scores stay, but it must drop
 * out of every public read and out of the vote path until it is re-enabled.
 */
function disabledCategoryFixture(): array
{
    $poll = Poll::factory()->create(['slug' => 'best-ministers', 'is_active' => true]);

    $published = CandidateGroup::factory()->create([
        'poll_id' => $poll->id,
        'name' => 'وزراء',
        'key' => 'ministers',
        'sort_order' => 0,
        'is_active' => true,
    ]);

    $disabled = CandidateGroup::factory()->create([
        'poll_id' => $poll->id,
        'name' => 'محافظون',
        'key' => 'governors',
        'sort_order' => 1,
        'is_active' => false,
    ]);

    $visible = Candidate::factory()->create([
        'poll_id' => $poll->id,
        'candidate_group_id' => $published->id,
        'name' => 'مرشح ظاهر',
    ]);

    $hidden = Candidate::factory()->create([
        'poll_id' => $poll->id,
        'candidate_group_id' => $disabled->id,
        'name' => 'مرشح مخفي',
    ]);

    return compact('poll', 'published', 'disabled', 'visible', 'hidden');
}

test('the tierlist page only sends published categories and their candidates', function () {
    ['disabled' => $disabled, 'published' => $published, 'visible' => $visible, 'hidden' => $hidden] =
        disabledCategoryFixture();

    $response = $this->get('/tierlist')->assertOk();

    $response->assertInertia(fn ($page) => $page
        ->component('TierList/Index')
        ->where('groups', fn ($groups) => collect($groups)->pluck('id')->all() === [$published->id])
        ->where('candidates', fn ($candidates) => collect($candidates)->pluck('id')->all() === [$visible->id])
        ->etc());

    // Guard the exact ids: nothing from the disabled category may leak through
    // any other prop either.
    $props = $response->viewData('page')['props'];
    expect($props['groups'])->not->toContain($disabled->id)
        ->and(collect($props['candidates'])->pluck('id'))->not->toContain($hidden->id);
});

test('the leaderboard leaves a disabled category out of its groups and rankings', function () {
    ['poll' => $poll, 'disabled' => $disabled, 'published' => $published, 'visible' => $visible, 'hidden' => $hidden] =
        disabledCategoryFixture();

    DailyScore::create(['poll_id' => $poll->id, 'candidate_id' => $visible->id, 'day' => '2026-10-01', 'votes' => 4, 'score' => 16]);
    DailyScore::create(['poll_id' => $poll->id, 'candidate_id' => $hidden->id, 'day' => '2026-10-01', 'votes' => 9, 'score' => 45]);

    $payload = $this->getJson('/api/polls/best-ministers/leaderboard')->assertOk()->json();

    expect(collect($payload['groups'])->pluck('id')->all())->toBe([$published->id])
        ->and(collect($payload['ministers'])->pluck('candidateId')->all())->toBe([$visible->id])
        // The disabled category keeps its scores in daily_scores but publishes
        // an empty bucket: no ranking rows, no history series.
        ->and($payload['governors'])->toBe([])
        ->and($payload['history'])->not->toHaveKey($hidden->id);

    // The service itself is the single source for both the JSON and the
    // Inertia leaderboard, so assert it directly as well.
    $built = app(TierlistLeaderboard::class)->build($poll);
    expect($built['groups']->pluck('id')->all())->toBe([$published->id])
        ->and($built['candidates']->has($hidden->id))->toBeFalse()
        ->and($built['candidates']->has($visible->id))->toBeTrue();

    expect($disabled->is_active)->toBeFalse();
});

test('a ballot cannot score candidates in a disabled category', function () {
    ['poll' => $poll, 'disabled' => $disabled] = disabledCategoryFixture();

    $hiddenCandidates = Candidate::factory()->count(3)->create([
        'poll_id' => $poll->id,
        'candidate_group_id' => $disabled->id,
    ]);

    $this->postJson('/api/submit', [
        'pollSlug' => 'best-ministers',
        'deviceId' => 'disabled-category-device',
        'tiers' => [
            'S' => [['candidateId' => $hiddenCandidates[0]->id, 'pos' => 0]],
            'A' => [['candidateId' => $hiddenCandidates[1]->id, 'pos' => 0]],
            'B' => [['candidateId' => $hiddenCandidates[2]->id, 'pos' => 0]],
        ],
    ])->assertStatus(422)
        ->assertJsonValidationErrors('tiers');

    $this->assertDatabaseCount('ballots', 0);
    $this->assertDatabaseCount('daily_scores', 0);
});

test('disabling a category keeps its candidates and can be undone', function () {
    ['disabled' => $disabled, 'hidden' => $hidden, 'published' => $published, 'visible' => $visible] =
        disabledCategoryFixture();

    $this->actingAs(User::factory()->withPermissions(['polls.edit'])->create())
        ->patchJson("/api/candidate-groups/{$published->id}", ['is_active' => false])
        ->assertOk()
        ->assertJsonPath('is_active', false);

    $this->assertDatabaseHas('candidate_groups', ['id' => $published->id, 'is_active' => false]);
    // The data is retained, not deleted.
    $this->assertDatabaseHas('candidates', ['id' => $visible->id, 'candidate_group_id' => $published->id]);
    $this->assertDatabaseHas('candidates', ['id' => $hidden->id]);

    $this->actingAs(User::factory()->withPermissions(['polls.edit'])->create())
        ->patchJson("/api/candidate-groups/{$published->id}", ['is_active' => true])
        ->assertOk()
        ->assertJsonPath('is_active', true);

    $this->assertDatabaseHas('candidate_groups', ['id' => $published->id, 'is_active' => true]);
    expect($disabled->fresh()->is_active)->toBeFalse();
});

test('disabling the default category clears the default flag', function () {
    ['published' => $published] = disabledCategoryFixture();
    $published->update(['is_default' => true]);

    $this->actingAs(User::factory()->withPermissions(['polls.edit'])->create())
        ->patchJson("/api/candidate-groups/{$published->id}", ['is_active' => false])
        ->assertOk();

    $fresh = $published->fresh();
    expect($fresh->is_active)->toBeFalse()
        ->and($fresh->is_default)->toBeFalse();
});

test('a disabled category cannot be made the default one', function () {
    ['disabled' => $disabled] = disabledCategoryFixture();

    $this->actingAs(User::factory()->withPermissions(['polls.edit'])->create())
        ->postJson("/api/candidate-groups/{$disabled->id}/default")
        ->assertStatus(422);

    expect($disabled->fresh()->is_default)->toBeFalse();
});

test('the poll editor JSON shows every category to editors and only published ones to guests', function () {
    ['disabled' => $disabled, 'published' => $published, 'visible' => $visible, 'hidden' => $hidden] =
        disabledCategoryFixture();

    // Guests see the public view: no disabled category, no candidate from it.
    $guest = $this->getJson('/api/polls/best-ministers')->assertOk()->json();
    expect(collect($guest['groups'])->pluck('id')->all())->toBe([$published->id])
        ->and(collect($guest['candidates'])->pluck('id')->all())->toBe([$visible->id]);

    // A polls editor sees everything, which is how a disabled category is
    // found again and re-enabled from /dashboard?edit-poll=…
    $editor = $this->actingAs(User::factory()->withPermissions(['polls.edit'])->create())
        ->getJson('/api/polls/best-ministers')
        ->assertOk()
        ->json();
    expect(collect($editor['groups'])->pluck('id')->all())->toBe([$published->id, $disabled->id])
        ->and(collect($editor['candidates'])->pluck('id')->all())->toBe([$visible->id, $hidden->id]);

    // Archived candidates stay available to whoever can edit, so the archive
    // editor keeps working.
    $hidden->update(['status' => 'archived']);
    $withArchived = $this->actingAs(User::factory()->withPermissions(['polls.edit'])->create())
        ->getJson('/api/polls/best-ministers?include_archived=1')
        ->assertOk()
        ->json();
    expect(collect($withArchived['candidates'])->pluck('id')->all())->toBe([$visible->id, $hidden->id]);
});
