<?php

use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Models\MediaCleanupJob;
use App\Models\Poll;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function mobileAdminBearer(User $user): string
{
    return $user->createToken('mobile:admin-test', ['mobile'])->plainTextToken;
}

function oversizedCandidatePixelUpload(): UploadedFile
{
    $header = pack('NNCCCCC', 4001, 2000, 8, 2, 0, 0, 0);
    $chunk = 'IHDR'.$header;
    $bytes = "\x89PNG\r\n\x1a\n".pack('N', strlen($header)).$chunk.pack('N', crc32($chunk));
    $path = tempnam(sys_get_temp_dir(), 'candidate-pixels').'.png';
    file_put_contents($path, $bytes);

    return new UploadedFile($path, 'candidate-pixels.png', 'image/png', null, true);
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

test('mobile candidate uploads use the configured media disk and expire when unclaimed', function () {
    Storage::fake('r2');
    config()->set('filesystems.media_disk', 'r2');
    $admin = User::factory()->create(['role' => 'admin']);

    $response = $this->withToken(mobileAdminBearer($admin))->post('/api/mobile/admin/uploads', [
        'image' => UploadedFile::fake()->image('candidate.png', 320, 320),
    ], ['Accept' => 'application/json']);

    $response->assertCreated()->assertJsonStructure(['data' => ['url']]);
    $path = 'candidates/'.basename($response->json('data.url'));
    Storage::disk('r2')->assertExists($path);
    $cleanup = MediaCleanupJob::query()->where('disk', 'r2')->where('path', $path)->firstOrFail();
    expect($cleanup->available_at->greaterThan(now()->addHours(23)))->toBeTrue();

    $this->withToken(mobileAdminBearer($admin))->post('/api/mobile/admin/uploads', [
        'image' => UploadedFile::fake()->create('candidate.svg', 4, 'image/svg+xml'),
    ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('image');

    $this->travel(25)->hours();
    $this->artisan('media:cleanup')->assertSuccessful();
    Storage::disk('r2')->assertMissing($path);
});

test('mobile candidate image adoption replacement deletion and poll cascade are durable', function () {
    Storage::fake('r2');
    config()->set('filesystems.media_disk', 'r2');
    $admin = User::factory()->create(['role' => 'admin']);
    $token = mobileAdminBearer($admin);
    $poll = Poll::factory()->create();
    $group = CandidateGroup::factory()->create(['poll_id' => $poll->id]);

    $upload = function (string $filename) use ($token): array {
        $url = $this->withToken($token)->post('/api/mobile/admin/uploads', [
            'image' => UploadedFile::fake()->image($filename, 320, 320),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.url');

        return [$url, 'candidates/'.basename($url)];
    };

    [$firstUrl, $firstPath] = $upload('first.png');
    $candidateId = $this->withToken($token)->postJson('/api/mobile/admin/candidates', [
        'groupId' => $group->id,
        'imageUrl' => $firstUrl,
        'name' => 'مرشح الصور',
        'pollId' => $poll->id,
        'title' => null,
    ])->assertCreated()->json('data.id');
    expect(MediaCleanupJob::query()->where('path', $firstPath)->exists())->toBeFalse();
    Storage::disk('r2')->assertExists($firstPath);

    [$secondUrl, $secondPath] = $upload('second.webp');
    $this->withToken($token)->putJson("/api/mobile/admin/candidates/{$candidateId}", [
        'groupId' => $group->id,
        'imageUrl' => $secondUrl,
        'name' => 'مرشح الصور',
        'title' => null,
    ])->assertOk();
    Storage::disk('r2')->assertMissing($firstPath);
    Storage::disk('r2')->assertExists($secondPath);
    expect(MediaCleanupJob::query()->where('path', $secondPath)->exists())->toBeFalse();

    $this->withToken($token)->deleteJson("/api/mobile/admin/candidates/{$candidateId}")->assertOk();
    Storage::disk('r2')->assertMissing($secondPath);

    [$cascadeUrl, $cascadePath] = $upload('cascade.jpg');
    $this->withToken($token)->postJson('/api/mobile/admin/candidates', [
        'groupId' => $group->id,
        'imageUrl' => $cascadeUrl,
        'name' => 'مرشح الحذف',
        'pollId' => $poll->id,
        'title' => null,
    ])->assertCreated();
    $this->withToken($token)->deleteJson("/api/mobile/admin/polls/{$poll->id}")->assertOk();
    Storage::disk('r2')->assertMissing($cascadePath);
});

test('mobile candidate uploads reject decoded images above the shared pixel budget', function () {
    Storage::fake('public');
    $admin = User::factory()->create(['role' => 'admin']);

    $this->withToken(mobileAdminBearer($admin))->post('/api/mobile/admin/uploads', [
        'image' => oversizedCandidatePixelUpload(),
    ], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('image');

    expect(Storage::disk('public')->allFiles('candidates'))->toBe([]);
});

test('mobile candidate uploads fail when the configured media disk refuses the write', function () {
    Storage::fake('r2');
    config()->set('filesystems.media_disk', 'r2');
    $disk = Storage::disk('r2');
    $failingDisk = Mockery::mock($disk)->makePartial();
    $failingDisk->shouldReceive('putFileAs')->once()->andReturnFalse();
    Storage::set('r2', $failingDisk);
    $admin = User::factory()->create(['role' => 'admin']);
    $this->withoutExceptionHandling();

    try {
        expect(fn () => $this->withToken(mobileAdminBearer($admin))
            ->post('/api/mobile/admin/uploads', [
                'image' => UploadedFile::fake()->image('candidate.png', 320, 320),
            ], ['Accept' => 'application/json']))
            ->toThrow(RuntimeException::class, 'Could not store candidate image');
    } finally {
        Storage::set('r2', $disk);
        $this->withExceptionHandling();
    }

    expect($disk->allFiles('candidates'))->toBe([]);
});
