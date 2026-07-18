<?php

use App\Models\MediaCleanupJob;
use App\Models\Poll;
use App\Models\User;
use App\Services\UserDeletionService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

function userWithStoredAvatar(string $email): array
{
    $user = User::factory()->create(['email' => $email]);
    $path = "avatars/{$user->id}/private.webp";
    Storage::disk('public')->put($path, 'private avatar');
    $user->forceFill([
        'avatar_disk' => 'public',
        'avatar_path' => $path,
        'avatar_url' => Storage::disk('public')->url($path),
    ])->save();

    return [$user, $path];
}

test('account deletion removes its stored avatar and active credentials after commit', function () {
    Storage::fake('public');
    $delegate = User::factory()->create(['role' => 'superadmin']);
    [$user, $avatarPath] = userWithStoredAvatar('delete-service@example.test');
    $poll = Poll::factory()->create(['user_id' => $user->id]);
    $tokenId = $user->createToken('delete-service', ['mobile'])->accessToken->id;
    DB::table('sessions')->insert([
        'id' => 'delete-service-session',
        'user_id' => $user->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'Deletion Test',
        'payload' => 'private session payload',
        'last_activity' => now()->timestamp,
    ]);

    expect(app(UserDeletionService::class)->deleteAccountAndTransferOwnership($user))->toBeTrue();

    Storage::disk('public')->assertMissing($avatarPath);
    $this->assertDatabaseMissing('personal_access_tokens', ['id' => $tokenId]);
    $this->assertDatabaseMissing('sessions', ['id' => 'delete-service-session']);
    expect($poll->fresh()->user_id)->toBe($delegate->id);
});

test('an outer rollback keeps the stored avatar and account', function () {
    Storage::fake('public');
    User::factory()->create(['role' => 'superadmin']);
    [$user, $avatarPath] = userWithStoredAvatar('rollback-service@example.test');

    expect(fn () => DB::transaction(function () use ($user): void {
        app(UserDeletionService::class)->deleteAccountAndTransferOwnership($user);

        throw new RuntimeException('force outer rollback');
    }))->toThrow(RuntimeException::class, 'force outer rollback');

    Storage::disk('public')->assertExists($avatarPath);
    expect($user->fresh()->deleted_at)->toBeNull()
        ->and($user->fresh()->email)->toBe('rollback-service@example.test');
});

test('a failed account avatar cleanup stays durable after identity deletion', function () {
    Storage::fake('public');
    [$user, $avatarPath] = userWithStoredAvatar('cleanup-service@example.test');
    $disk = Storage::disk('public');
    $failingDisk = Mockery::mock($disk)->makePartial();
    $failingDisk->shouldReceive('deleteDirectory')->once()->andReturnFalse();
    Storage::set('public', $failingDisk);

    expect(app(UserDeletionService::class)->deleteAccountAndTransferOwnership($user))->toBeTrue();

    expect(MediaCleanupJob::query()->where('disk', 'public')->where('path', "avatars/{$user->id}")->count())->toBe(1)
        ->and(User::withTrashed()->findOrFail($user->id)->avatar_url)->toBeNull();
    $disk->assertExists($avatarPath);

    Storage::set('public', $disk);
    $this->travel(2)->minutes();
    $this->artisan('media:cleanup')->assertSuccessful();
    $disk->assertMissing($avatarPath);
});

test('deletion preserves content ownership when no delegate exists', function () {
    Storage::fake('public');
    $user = User::factory()->create(['role' => 'user']);
    $poll = Poll::factory()->create(['user_id' => $user->id]);

    expect(app(UserDeletionService::class)->deleteAccountAndTransferOwnership($user))->toBeTrue()
        ->and($poll->fresh()->user_id)->toBe($user->id);
});
