<?php

use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Models\MediaCleanupJob;
use App\Models\Poll;
use App\Models\User;
use App\Services\CandidateImageService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

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

test('web candidate image replacement sharing deletion and poll cascade are durable', function () {
    Storage::fake('r2');
    config()->set('filesystems.media_disk', 'r2');
    $admin = User::factory()->create(['role' => 'admin']);
    $poll = Poll::factory()->create();
    $images = app(CandidateImageService::class);

    $first = $images->store(UploadedFile::fake()->image('first.png', 320, 320));
    $candidateId = $this->actingAs($admin)->postJson('/api/candidates', [
        'image_url' => $first->url,
        'name' => 'First candidate',
        'poll_id' => $poll->id,
    ])->assertCreated()->json('id');
    expect(MediaCleanupJob::query()->where('path', $first->path)->exists())->toBeFalse();

    $second = $images->store(UploadedFile::fake()->image('second.webp', 320, 320));
    $this->actingAs($admin)->putJson("/api/candidates/{$candidateId}", [
        'image_url' => $second->url,
    ])->assertOk();
    Storage::disk('r2')->assertMissing($first->path);
    Storage::disk('r2')->assertExists($second->path);

    $sharedId = $this->actingAs($admin)->postJson('/api/candidates', [
        'image_url' => $second->url,
        'name' => 'Shared candidate',
        'poll_id' => $poll->id,
    ])->assertCreated()->json('id');
    $this->actingAs($admin)->deleteJson("/api/candidates/{$candidateId}")->assertNoContent();
    Storage::disk('r2')->assertExists($second->path);
    $this->actingAs($admin)->deleteJson("/api/candidates/{$sharedId}")->assertNoContent();
    Storage::disk('r2')->assertMissing($second->path);

    $cascade = $images->store(UploadedFile::fake()->image('cascade.jpg', 320, 320));
    $this->actingAs($admin)->postJson('/api/candidates', [
        'image_url' => $cascade->url,
        'name' => 'Cascade candidate',
        'poll_id' => $poll->id,
    ])->assertCreated();
    $this->actingAs($admin)->deleteJson("/api/polls/{$poll->id}")->assertNoContent();
    Storage::disk('r2')->assertMissing($cascade->path);
});
