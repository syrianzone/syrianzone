<?php

use App\Models\User;
use App\Services\AvatarService;
use App\Services\ImageDecodeGuard;
use App\Services\MediaCleanupService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\GoogleProvider;
use Laravel\Socialite\Two\User as SocialiteUser;

// UserFactory defaults role to admin; regular users must be explicit.
function avatarUser(array $attrs = []): User
{
    return User::factory()->create(array_merge(['role' => 'user'], $attrs));
}

function fakeGoogleLogin(string $email): void
{
    $provider = Mockery::mock(GoogleProvider::class);
    $provider->shouldReceive('stateless')->andReturnSelf();
    $provider->shouldReceive('user')->andReturn((new SocialiteUser)->setRaw([])->map([
        'id' => 'google-id-1',
        'name' => 'Google Name',
        'email' => $email,
        'avatar' => 'https://lh3.googleusercontent.com/fresh-avatar',
    ]));
    Socialite::shouldReceive('driver')->with('google')->andReturn($provider);
}

test('guest cannot upload an avatar', function () {
    Storage::fake('public');

    $this->postJson('/api/account/avatar', [
        'avatar' => UploadedFile::fake()->image('a.jpg', 300, 300),
    ])->assertUnauthorized();
});

test('user can upload an avatar', function () {
    Storage::fake('public');
    $user = avatarUser();

    $response = $this->actingAs($user)
        ->postJson('/api/account/avatar', [
            'avatar' => UploadedFile::fake()->image('a.jpg', 640, 480),
        ])
        ->assertOk();

    $files = Storage::disk('public')->files("avatars/{$user->id}");
    expect($files)->toHaveCount(1);
    $path = $files[0];
    expect($path)->toEndWith('.webp');

    $url = $response->json('avatar_url');
    expect($url)->toBe(Storage::disk('public')->url($path));
    expect($user->fresh()->avatar_url)->toBe($url)
        ->and($user->fresh()->avatar_disk)->toBe('public')
        ->and($user->fresh()->avatar_path)->toBe($path);

    // server-side square crop to 256
    [$width, $height] = getimagesizefromstring(Storage::disk('public')->get($path));
    expect($width)->toBe(256);
    expect($height)->toBe(256);
});

test('a second upload deletes the previous hosted avatar file', function () {
    Storage::fake('public');
    $user = avatarUser();

    $this->actingAs($user)->postJson('/api/account/avatar', [
        'avatar' => UploadedFile::fake()->image('a.jpg', 300, 300),
    ])->assertOk();
    $firstPath = Storage::disk('public')->files("avatars/{$user->id}")[0];

    $this->actingAs($user)->postJson('/api/account/avatar', [
        'avatar' => UploadedFile::fake()->image('b.png', 300, 300),
    ])->assertOk();

    Storage::disk('public')->assertMissing($firstPath);
    expect(Storage::disk('public')->files("avatars/{$user->id}"))->toHaveCount(1);
});

test('a google-hosted old avatar url is left alone, only the row is updated', function () {
    Storage::fake('public');
    $user = avatarUser(['avatar_url' => 'https://lh3.googleusercontent.com/a/old-avatar=s96-c']);

    $response = $this->actingAs($user)->postJson('/api/account/avatar', [
        'avatar' => UploadedFile::fake()->image('a.jpg', 300, 300),
    ])->assertOk();

    expect($user->fresh()->avatar_url)->toBe($response->json('avatar_url'));
    expect(Storage::disk('public')->files("avatars/{$user->id}"))->toHaveCount(1);
});

test('rejects a non-image upload', function () {
    Storage::fake('public');

    $this->actingAs(avatarUser())->postJson('/api/account/avatar', [
        'avatar' => UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf'),
    ])->assertStatus(422)->assertJsonValidationErrors('avatar');
});

test('rejects an upload above 4MB', function () {
    Storage::fake('public');

    $this->actingAs(avatarUser())->postJson('/api/account/avatar', [
        'avatar' => UploadedFile::fake()->image('big.jpg')->size(5000),
    ])->assertStatus(422)->assertJsonValidationErrors('avatar');
});

function oversizedAvatarPixelUpload(): UploadedFile
{
    $header = pack('NNCCCCC', 5000, 5000, 8, 2, 0, 0, 0);
    $chunk = 'IHDR'.$header;
    $bytes = "\x89PNG\r\n\x1a\n".pack('N', strlen($header)).$chunk.pack('N', crc32($chunk));
    $path = tempnam(sys_get_temp_dir(), 'avatar-pixels').'.png';
    file_put_contents($path, $bytes);

    return new UploadedFile($path, 'avatar-pixels.png', 'image/png', null, true);
}

test('rejects an avatar above the safe pixel area before decoding it', function () {
    Storage::fake('public');
    $avatar = oversizedAvatarPixelUpload();

    expect(app(AvatarService::class)->dimensionsAreSafe($avatar))->toBeFalse();

    $this->actingAs(avatarUser())->postJson('/api/account/avatar', [
        'avatar' => $avatar,
    ])->assertUnprocessable()->assertJsonValidationErrors('avatar');
});

test('google login does not clobber a custom avatar', function () {
    Storage::fake('public');
    $user = avatarUser();

    $this->actingAs($user)->postJson('/api/account/avatar', [
        'avatar' => UploadedFile::fake()->image('a.jpg', 300, 300),
    ])->assertOk();
    $custom = $user->fresh()->avatar_url;

    fakeGoogleLogin($user->email);
    $this->get('/auth/google/callback')->assertRedirect();

    expect($user->fresh()->avatar_url)->toBe($custom);
});

test('google login still refreshes a google-hosted avatar', function () {
    Storage::fake('public');
    $user = avatarUser(['avatar_url' => 'https://lh3.googleusercontent.com/a/stale']);

    fakeGoogleLogin($user->email);
    $this->get('/auth/google/callback')->assertRedirect();

    expect($user->fresh()->avatar_url)->toBe('https://lh3.googleusercontent.com/fresh-avatar');
});

test('avatar replacement deletes the old object from its recorded disk', function () {
    Storage::fake('old-avatars');
    Storage::fake('public');
    $user = avatarUser();

    config(['filesystems.media_disk' => 'old-avatars']);
    app(AvatarService::class)->update($user, UploadedFile::fake()->image('old.jpg', 300, 300));
    $oldPath = $user->fresh()->avatar_path;

    config(['filesystems.media_disk' => 'public']);
    app(AvatarService::class)->update($user->fresh(), UploadedFile::fake()->image('new.jpg', 300, 300));

    Storage::disk('old-avatars')->assertMissing($oldPath);
    expect($user->fresh()->avatar_disk)->toBe('public');
});

test("a stale deleted account can't publish a new avatar", function () {
    Storage::fake('public');
    $user = avatarUser();
    $user->delete();

    expect(fn () => app(AvatarService::class)->update(
        $user,
        UploadedFile::fake()->image('stale.jpg', 300, 300),
    ))->toThrow(RuntimeException::class, 'Account is inactive');

    expect(Storage::disk('public')->allFiles("avatars/{$user->id}"))->toBeEmpty();
});

test('avatar failure preserves its original error when durable cleanup cannot be queued', function () {
    Storage::fake('public');
    $user = avatarUser();
    $user->delete();
    $cleanup = Mockery::mock(MediaCleanupService::class);
    $cleanup->shouldReceive('queueFiles')->once()->andThrow(new RuntimeException('cleanup database unavailable'));
    $avatars = new AvatarService(app(ImageDecodeGuard::class), $cleanup);

    expect(fn () => $avatars->update(
        $user,
        UploadedFile::fake()->image('stale.jpg', 300, 300),
    ))->toThrow(RuntimeException::class, 'Account is inactive');

    expect(Storage::disk('public')->allFiles("avatars/{$user->id}"))->toBeEmpty();
});

test('google login ignores avatar-looking urls without recorded storage ownership', function () {
    Storage::fake('public');
    $user = avatarUser([
        'avatar_url' => 'https://images.example.test/avatars/999/foreign.webp',
        'avatar_disk' => null,
        'avatar_path' => null,
    ]);

    fakeGoogleLogin($user->email);
    $this->get('/auth/google/callback')->assertRedirect();

    expect($user->fresh()->avatar_url)->toBe('https://lh3.googleusercontent.com/fresh-avatar')
        ->and($user->fresh()->avatar_disk)->toBeNull()
        ->and($user->fresh()->avatar_path)->toBeNull();
});
