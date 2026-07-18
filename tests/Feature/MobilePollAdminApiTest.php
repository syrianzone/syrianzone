<?php

use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Models\Poll;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function mobileAdminBearer(User $user): string
{
    return $user->createToken('mobile:admin-test', ['mobile'])->plainTextToken;
}

test('mobile poll administration rejects non-admin and non-mobile tokens', function () {
    $user = User::factory()->create(['role' => 'user']);
    $admin = User::factory()->create(['role' => 'admin']);
    $wildcard = $admin->createToken('browser', ['*'])->plainTextToken;

    $this->withToken(mobileAdminBearer($user))->getJson('/api/mobile/admin/polls')->assertForbidden();
    $this->withToken($wildcard)->getJson('/api/mobile/admin/polls')->assertUnauthorized();
});

test('mobile admin poll catalog and detail include inactive and archived records', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $poll = Poll::factory()->create(['is_active' => false]);
    $group = CandidateGroup::factory()->create(['poll_id' => $poll->id]);
    $candidate = Candidate::factory()->create([
        'candidate_group_id' => $group->id,
        'poll_id' => $poll->id,
        'status' => 'archived',
    ]);
    $token = mobileAdminBearer($admin);

    $this->withToken($token)->getJson('/api/mobile/admin/polls')
        ->assertOk()
        ->assertJsonPath('data.0.id', $poll->id)
        ->assertJsonPath('data.0.candidatesCount', 1);

    $this->withToken($token)->getJson("/api/mobile/admin/polls/{$poll->id}")
        ->assertOk()
        ->assertJsonPath('data.poll.isActive', false)
        ->assertJsonPath('data.groups.0.id', $group->id)
        ->assertJsonPath('data.candidates.0.id', $candidate->id)
        ->assertJsonPath('data.candidates.0.status', 'archived');
});

test('mobile admins can create update and delete polls but not the core poll', function () {
    $admin = User::factory()->create(['role' => 'superadmin']);
    $token = mobileAdminBearer($admin);
    $payload = [
        'isActive' => false,
        'slug' => 'community-poll',
        'timezone' => 'Asia/Damascus',
        'title' => 'Community poll',
    ];

    $created = $this->withToken($token)->postJson('/api/mobile/admin/polls', $payload)
        ->assertCreated()
        ->assertJsonPath('data.slug', 'community-poll')
        ->json('data.id');

    $this->withToken($token)->putJson("/api/mobile/admin/polls/{$created}", [
        ...$payload,
        'isActive' => true,
        'title' => 'Updated poll',
    ])->assertOk()->assertJsonPath('data.title', 'Updated poll');

    $this->withToken($token)->deleteJson("/api/mobile/admin/polls/{$created}")
        ->assertOk()->assertExactJson(['data' => ['deleted' => true]]);

    $core = Poll::factory()->create(['slug' => 'best-ministers']);
    $this->withToken($token)->deleteJson("/api/mobile/admin/polls/{$core->id}")->assertForbidden();
});

test('mobile admins manage group order and the single default group', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $poll = Poll::factory()->create();
    $token = mobileAdminBearer($admin);
    $first = CandidateGroup::factory()->create(['poll_id' => $poll->id, 'sort_order' => 0]);

    $second = $this->withToken($token)->postJson('/api/mobile/admin/candidate-groups', [
        'name' => 'المحافظون',
        'pollId' => $poll->id,
    ])->assertCreated()->json('data.id');

    $this->withToken($token)->postJson('/api/mobile/admin/candidate-groups/reorder', ['groups' => [
        ['id' => $first->id, 'sortOrder' => 1],
        ['id' => $second, 'sortOrder' => 0],
    ]])->assertOk()->assertJsonPath('data.groups.0.id', $second);

    $this->withToken($token)->postJson("/api/mobile/admin/candidate-groups/{$second}/default")
        ->assertOk()->assertJsonPath('data.isDefault', true);
    expect($first->fresh()->is_default)->toBeFalse();

    $this->withToken($token)->putJson("/api/mobile/admin/candidate-groups/{$second}", ['name' => 'المحافظات'])
        ->assertOk()->assertJsonPath('data.name', 'المحافظات');
    $this->withToken($token)->deleteJson("/api/mobile/admin/candidate-groups/{$second}")
        ->assertOk()->assertExactJson(['data' => ['deleted' => true]]);
});

test('mobile group reorder rejects groups from different polls', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $groups = [CandidateGroup::factory()->create(), CandidateGroup::factory()->create()];

    $this->withToken(mobileAdminBearer($admin))->postJson('/api/mobile/admin/candidate-groups/reorder', ['groups' => [
        ['id' => $groups[0]->id, 'sortOrder' => 0],
        ['id' => $groups[1]->id, 'sortOrder' => 1],
    ]])->assertUnprocessable()->assertJsonValidationErrors('groups');
});

test('mobile admins create edit archive restore and delete candidates within one poll', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $poll = Poll::factory()->create();
    $group = CandidateGroup::factory()->create(['poll_id' => $poll->id]);
    $successor = Candidate::factory()->create(['candidate_group_id' => $group->id, 'poll_id' => $poll->id]);
    $token = mobileAdminBearer($admin);

    $candidate = $this->withToken($token)->postJson('/api/mobile/admin/candidates', [
        'groupId' => $group->id,
        'imageUrl' => '/candidates/new.png',
        'name' => 'مرشح جديد',
        'pollId' => $poll->id,
        'title' => 'وزير',
    ])->assertCreated()->assertJsonPath('data.status', 'active')->json('data.id');

    $this->withToken($token)->putJson("/api/mobile/admin/candidates/{$candidate}", [
        'groupId' => $group->id,
        'imageUrl' => null,
        'name' => 'مرشح معدل',
        'title' => null,
    ])->assertOk()->assertJsonPath('data.name', 'مرشح معدل');

    $this->withToken($token)->patchJson("/api/mobile/admin/candidates/{$candidate}/archive", [
        'archiveReason' => 'انتهاء التكليف',
        'successorId' => $successor->id,
        'termEndedAt' => '2026-07-16',
    ])->assertOk()->assertJsonPath('data.status', 'archived');

    $this->withToken($token)->patchJson("/api/mobile/admin/candidates/{$candidate}/restore")
        ->assertOk()->assertJsonPath('data.status', 'active');
    $this->withToken($token)->deleteJson("/api/mobile/admin/candidates/{$candidate}")
        ->assertOk()->assertExactJson(['data' => ['deleted' => true]]);
});

test('mobile candidate uploads accept bounded raster images on the public disk', function () {
    Storage::fake('public');
    $admin = User::factory()->create(['role' => 'admin']);

    $response = $this->withToken(mobileAdminBearer($admin))->post('/api/mobile/admin/uploads', [
        'image' => UploadedFile::fake()->image('candidate.png', 320, 320),
    ], ['Accept' => 'application/json']);

    $response->assertCreated()->assertJsonStructure(['data' => ['url']]);
    expect($response->json('data.url'))->toStartWith('/storage/candidates/');
    Storage::disk('public')->assertExists('candidates/'.basename($response->json('data.url')));

    $this->withToken(mobileAdminBearer($admin))->post('/api/mobile/admin/uploads', [
        'image' => UploadedFile::fake()->create('candidate.svg', 4, 'image/svg+xml'),
    ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('image');
});
