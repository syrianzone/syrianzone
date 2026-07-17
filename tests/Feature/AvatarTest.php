<?php

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;

// UserFactory defaults role to admin; regular users must be explicit.
function avatarUser(array $attrs = []): User {
  return User::factory()->create(array_merge(['role' => 'user'], $attrs));
}

function fakeGoogleLogin(string $email): void {
  $provider = Mockery::mock(\Laravel\Socialite\Two\GoogleProvider::class);
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
  expect($user->fresh()->avatar_url)->toBe($url);

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
  ])->assertStatus(422)
    ->assertJsonValidationErrors('avatar')
    ->assertJsonPath('errors.avatar.0', 'الملف يجب أن يكون صورة');
});

test('rejects an unsupported image format with the arabic mimes message', function () {
  Storage::fake('public');

  $this->actingAs(avatarUser())->postJson('/api/account/avatar', [
    'avatar' => UploadedFile::fake()->image('a.gif', 300, 300),
  ])->assertStatus(422)
    ->assertJsonPath('errors.avatar.0', 'الصورة يجب أن تكون بصيغة JPG أو PNG أو WebP');
});

test('rejects a missing avatar with the arabic required message', function () {
  Storage::fake('public');

  $this->actingAs(avatarUser())->postJson('/api/account/avatar', [])
    ->assertStatus(422)
    ->assertJsonPath('errors.avatar.0', 'اختر صورة');
});

test('rejects an upload above 4MB', function () {
  Storage::fake('public');

  $this->actingAs(avatarUser())->postJson('/api/account/avatar', [
    'avatar' => UploadedFile::fake()->image('big.jpg')->size(5000),
  ])->assertStatus(422)
    ->assertJsonValidationErrors('avatar')
    ->assertJsonPath('errors.avatar.0', 'حجم الصورة يجب ألا يتجاوز 4 ميغابايت');
});

test('rejects a too-small avatar with the arabic dimensions message', function () {
  Storage::fake('public');

  $this->actingAs(avatarUser())->postJson('/api/account/avatar', [
    'avatar' => UploadedFile::fake()->image('small.png', 32, 32),
  ])->assertStatus(422)
    ->assertJsonPath('errors.avatar.0', 'أبعاد الصورة يجب أن تكون بين 64x64 و 6000x6000 بكسل');
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
