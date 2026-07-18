<?php

use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\GoogleProvider;
use Laravel\Socialite\Two\User as SocialiteUser;

beforeEach(function () {
    config([
        'mobile-auth.allowed_redirect_uris' => ['syrianzone://auth/callback'],
        'mobile-auth.authorization_ttl_minutes' => 10,
        'mobile-auth.exchange_ttl_minutes' => 2,
        'mobile-auth.token_ttl_minutes' => 43_200,
        'services.google.client_id' => 'google-client-id',
        'services.google.client_secret' => 'google-client-secret',
        'services.google.redirect' => 'https://example.test/auth/google/callback',
    ]);
});

function mobileAuthVerifier(): string
{
    return str_repeat('v', 64);
}

function mobileAuthChallenge(string $verifier): string
{
    return rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
}

function mobileSocialiteUser(string $email): SocialiteUser
{
    return (new SocialiteUser)->setRaw([])->map([
        'id' => 'google-user-id',
        'name' => 'Mobile Admin',
        'email' => $email,
        'avatar' => 'https://images.example.test/avatar.png',
    ]);
}

function seedMobileAuthRecord(array $overrides = []): array
{
    $verifier = $overrides['verifier'] ?? mobileAuthVerifier();
    $exchangeCode = $overrides['exchange_code'] ?? 'exchange_'.str()->random(48);
    $oauthState = $overrides['oauth_state'] ?? 'oauth_'.str()->random(48);
    $appState = $overrides['app_state'] ?? 'app_'.str()->random(48);

    $attributes = array_merge([
        'id' => (string) str()->uuid(),
        'oauth_state_hash' => hash('sha256', $oauthState),
        'app_state' => Crypt::encryptString($appState),
        'redirect_uri' => 'syrianzone://auth/callback',
        'code_challenge' => mobileAuthChallenge($verifier),
        'exchange_code_hash' => hash('sha256', $exchangeCode),
        'user_id' => null,
        'expires_at' => now()->addMinutes(10),
        'authorized_at' => null,
        'exchange_expires_at' => null,
        'exchanged_at' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ], collect($overrides)->except([
        'verifier',
        'exchange_code',
        'oauth_state',
        'app_state',
    ])->all());

    DB::table('mobile_auth_codes')->insert($attributes);

    return compact('verifier', 'exchangeCode', 'oauthState', 'appState') + [
        'id' => $attributes['id'],
    ];
}

test('mobile Google login binds app state and an S256 challenge to a server state', function () {
    $appState = 'state_'.str_repeat('a', 48);
    $challenge = mobileAuthChallenge(mobileAuthVerifier());

    $response = $this->get('/api/mobile/auth/google?'.http_build_query([
        'redirect_uri' => 'syrianzone://auth/callback',
        'state' => $appState,
        'code_challenge' => $challenge,
        'code_challenge_method' => 'S256',
    ]));

    $response->assertRedirect();
    $location = $response->headers->get('Location');
    parse_str((string) parse_url($location, PHP_URL_QUERY), $query);

    expect(parse_url($location, PHP_URL_HOST))->toBe('accounts.google.com')
        ->and($query['state'] ?? null)->toBeString()
        ->and($query['state'])->not->toBe($appState)
        ->and($query['redirect_uri'] ?? null)->toBe(url('/api/mobile/auth/google/callback'))
        ->and(DB::table('mobile_auth_codes')->count())->toBe(1)
        ->and(DB::table('mobile_auth_codes')->value('oauth_state_hash'))->toBe(hash('sha256', $query['state']))
        ->and(DB::table('mobile_auth_codes')->value('app_state'))->not->toContain($appState)
        ->and(DB::table('mobile_auth_codes')->value('code_challenge'))->toBe($challenge);
});

test('mobile Google login rejects unlisted callbacks and malformed PKCE input', function () {
    $valid = [
        'redirect_uri' => 'https://attacker.example.test/callback',
        'state' => 'state_'.str_repeat('a', 48),
        'code_challenge' => mobileAuthChallenge(mobileAuthVerifier()),
        'code_challenge_method' => 'S256',
    ];

    $this->getJson('/api/mobile/auth/google?'.http_build_query($valid))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('redirect_uri');

    $valid['redirect_uri'] = 'syrianzone://auth/callback';
    $valid['code_challenge'] = 'short';

    $this->getJson('/api/mobile/auth/google?'.http_build_query($valid))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('code_challenge');

    $valid['code_challenge'] = str_repeat('x', 44);

    $this->getJson('/api/mobile/auth/google?'.http_build_query($valid))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('code_challenge');

    expect(DB::table('mobile_auth_codes')->count())->toBe(0);
});

test('Google callback returns a single-use code and the original app state', function () {
    $user = User::factory()->create(['email' => 'admin@example.test']);
    $record = seedMobileAuthRecord([
        'user_id' => null,
        'exchange_code_hash' => null,
    ]);

    $provider = Mockery::mock(GoogleProvider::class);
    Socialite::shouldReceive('buildProvider')->once()
        ->withArgs(fn (string $providerClass, array $config) => $providerClass === GoogleProvider::class
          && $config['redirect'] === url('/api/mobile/auth/google/callback')
        )->andReturn($provider);
    $provider->shouldReceive('stateless')->once()->andReturnSelf();
    $provider->shouldReceive('user')->once()->andReturn(mobileSocialiteUser($user->email));

    $response = $this->get('/api/mobile/auth/google/callback?'.http_build_query([
        'state' => $record['oauthState'],
        'code' => 'google-authorization-code',
    ]));

    $response->assertRedirect();
    $location = $response->headers->get('Location');
    parse_str((string) parse_url($location, PHP_URL_QUERY), $query);
    $stored = DB::table('mobile_auth_codes')->where('id', $record['id'])->first();

    expect(strtok($location, '?'))->toBe('syrianzone://auth/callback')
        ->and($query['state'] ?? null)->toBe($record['appState'])
        ->and($query['code'] ?? null)->toBeString()
        ->and(hash('sha256', $query['code']))->toBe($stored->exchange_code_hash)
        ->and($stored->user_id)->toBe($user->id)
        ->and($stored->authorized_at)->not->toBeNull()
        ->and($stored->exchange_expires_at)->not->toBeNull();

    $this->getJson('/api/mobile/auth/google/callback?'.http_build_query([
        'state' => $record['oauthState'],
        'code' => 'replayed-google-authorization-code',
    ]))->assertStatus(410)->assertJson(['error' => 'invalid_login']);
});

test('Google callback rejects expired or replayed browser state before calling Google', function () {
    $expired = seedMobileAuthRecord([
        'expires_at' => now()->subSecond(),
        'exchange_code_hash' => null,
    ]);

    Socialite::shouldReceive('buildProvider')->never();

    $this->getJson('/api/mobile/auth/google/callback?'.http_build_query([
        'state' => $expired['oauthState'],
        'code' => 'google-authorization-code',
    ]))->assertStatus(410)->assertJson(['error' => 'invalid_login']);
});

test('Google callback creates an unknown account as a regular contributor', function () {
    $record = seedMobileAuthRecord(['exchange_code_hash' => null]);
    $provider = Mockery::mock(GoogleProvider::class);
    Socialite::shouldReceive('buildProvider')->once()->andReturn($provider);
    $provider->shouldReceive('stateless')->once()->andReturnSelf();
    $provider->shouldReceive('user')->once()->andReturn(mobileSocialiteUser('visitor@example.test'));

    $response = $this->get('/api/mobile/auth/google/callback?'.http_build_query([
        'state' => $record['oauthState'],
        'code' => 'google-authorization-code',
    ]));

    $response->assertRedirect();
    parse_str((string) parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);

    $user = User::where('email', 'visitor@example.test')->firstOrFail();

    expect($query['code'] ?? null)->toBeString()
        ->and($query['state'] ?? null)->toBe($record['appState'])
        ->and($user->google_id)->toBe('google-user-id')
        ->and($user->role)->toBe('user');
});

test('Google callback rejects a banned account before issuing a code', function () {
    $user = User::factory()->create([
        'email' => 'banned@example.test',
        'google_id' => 'google-user-id',
        'is_banned' => true,
    ]);
    $record = seedMobileAuthRecord(['exchange_code_hash' => null]);
    $provider = Mockery::mock(GoogleProvider::class);
    Socialite::shouldReceive('buildProvider')->once()->andReturn($provider);
    $provider->shouldReceive('stateless')->once()->andReturnSelf();
    $provider->shouldReceive('user')->once()->andReturn(mobileSocialiteUser($user->email));

    $response = $this->get('/api/mobile/auth/google/callback?'.http_build_query([
        'state' => $record['oauthState'],
        'code' => 'google-authorization-code',
    ]));

    parse_str((string) parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);

    expect($query)->toMatchArray([
        'error' => 'access_denied',
        'state' => $record['appState'],
    ])->and(DB::table('mobile_auth_codes')->where('id', $record['id'])->value('exchange_code_hash'))
        ->toBeNull();
});

test('Google callback does not restore a legacy soft-deleted account', function () {
    $user = User::factory()->create([
        'email' => 'deleted@example.test',
        'google_id' => 'google-user-id',
        'role' => 'admin',
    ]);
    $user->delete();
    $record = seedMobileAuthRecord(['exchange_code_hash' => null]);
    $provider = Mockery::mock(GoogleProvider::class);
    Socialite::shouldReceive('buildProvider')->once()->andReturn($provider);
    $provider->shouldReceive('stateless')->once()->andReturnSelf();
    $provider->shouldReceive('user')->once()->andReturn(mobileSocialiteUser('deleted@example.test'));

    $response = $this->get('/api/mobile/auth/google/callback?'.http_build_query([
        'state' => $record['oauthState'],
        'code' => 'google-authorization-code',
    ]));

    parse_str((string) parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);

    expect($query['error'] ?? null)->toBe('access_denied')
        ->and(User::withTrashed()->findOrFail($user->id)->trashed())->toBeTrue()
        ->and(User::where('email', 'deleted@example.test')->exists())->toBeFalse();
});

test('Google callback preserves a custom uploaded avatar', function () {
    $user = User::factory()->create([
        'email' => 'avatar@example.test',
        'google_id' => 'google-user-id',
    ]);
    $customAvatar = "https://cdn.example.test/avatars/{$user->id}/custom.webp";
    $user->forceFill([
        'avatar_disk' => 'public',
        'avatar_path' => "avatars/{$user->id}/custom.webp",
        'avatar_url' => $customAvatar,
    ])->save();
    $record = seedMobileAuthRecord(['exchange_code_hash' => null]);
    $provider = Mockery::mock(GoogleProvider::class);
    Socialite::shouldReceive('buildProvider')->once()->andReturn($provider);
    $provider->shouldReceive('stateless')->once()->andReturnSelf();
    $provider->shouldReceive('user')->once()->andReturn(mobileSocialiteUser($user->email));

    $response = $this->get('/api/mobile/auth/google/callback?'.http_build_query([
        'state' => $record['oauthState'],
        'code' => 'google-authorization-code',
    ]));

    parse_str((string) parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);

    expect($query['code'] ?? null)->toBeString()
        ->and($user->fresh()->avatar_url)->toBe($customAvatar);
});

test('Google callback rejects a different subject for an already linked email', function () {
    $user = User::factory()->create([
        'email' => 'admin@example.test',
        'google_id' => 'original-google-subject',
    ]);
    $record = seedMobileAuthRecord(['exchange_code_hash' => null]);
    $provider = Mockery::mock(GoogleProvider::class);
    Socialite::shouldReceive('buildProvider')->once()->andReturn($provider);
    $provider->shouldReceive('stateless')->once()->andReturnSelf();
    $provider->shouldReceive('user')->once()->andReturn(mobileSocialiteUser($user->email));

    $response = $this->get('/api/mobile/auth/google/callback?'.http_build_query([
        'state' => $record['oauthState'],
        'code' => 'google-authorization-code',
    ]));

    parse_str((string) parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);

    expect($query['error'] ?? null)->toBe('access_denied')
        ->and($user->fresh()->google_id)->toBe('original-google-subject')
        ->and(DB::table('mobile_auth_codes')->where('id', $record['id'])->value('exchange_code_hash'))
        ->toBeNull();
});

test('Google callback follows a stable subject when its email changes', function () {
    $user = User::factory()->create([
        'email' => 'old-admin@example.test',
        'google_id' => 'google-user-id',
    ]);
    $record = seedMobileAuthRecord(['exchange_code_hash' => null]);
    $provider = Mockery::mock(GoogleProvider::class);
    Socialite::shouldReceive('buildProvider')->once()->andReturn($provider);
    $provider->shouldReceive('stateless')->once()->andReturnSelf();
    $provider->shouldReceive('user')->once()->andReturn(mobileSocialiteUser('new-admin@example.test'));

    $response = $this->get('/api/mobile/auth/google/callback?'.http_build_query([
        'state' => $record['oauthState'],
        'code' => 'google-authorization-code',
    ]));

    parse_str((string) parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);

    expect($query['code'] ?? null)->toBeString()
        ->and($user->fresh()->email)->toBe('new-admin@example.test')
        ->and(User::count())->toBe(1);
});

test('a Google subject can belong to only one local user', function () {
    User::factory()->create(['google_id' => 'unique-google-subject']);

    expect(fn () => User::factory()->create(['google_id' => 'unique-google-subject']))
        ->toThrow(UniqueConstraintViolationException::class);
});

test('a matching PKCE verifier exchanges the code for an expiring Sanctum token', function () {
    $user = User::factory()->create([
        'email' => 'admin@example.test',
        'google_id' => 'private-google-id',
    ]);
    $record = seedMobileAuthRecord([
        'user_id' => $user->id,
        'authorized_at' => now(),
        'exchange_expires_at' => now()->addMinutes(2),
    ]);

    $response = $this->postJson('/api/mobile/auth/exchange', [
        'code' => $record['exchangeCode'],
        'code_verifier' => $record['verifier'],
        'device_name' => 'iPhone 17 Pro',
    ]);

    $response->assertOk()
        ->assertJsonPath('token_type', 'Bearer')
        ->assertJsonPath('user.id', $user->id)
        ->assertJsonPath('user.email', $user->email)
        ->assertJsonMissingPath('user.google_id')
        ->assertJsonStructure(['token', 'token_type', 'expires_at', 'user']);

    expect(DB::table('mobile_auth_codes')->where('id', $record['id'])->value('exchanged_at'))
        ->not->toBeNull()
        ->and($user->tokens()->count())->toBe(1)
        ->and($user->tokens()->first()->name)->toBe('mobile:iPhone 17 Pro')
        ->and($user->tokens()->first()->expires_at)->not->toBeNull();
});

test('exchange rejects a wrong verifier without consuming the code', function () {
    $user = User::factory()->create();
    $record = seedMobileAuthRecord([
        'user_id' => $user->id,
        'authorized_at' => now(),
        'exchange_expires_at' => now()->addMinutes(2),
    ]);

    $this->postJson('/api/mobile/auth/exchange', [
        'code' => $record['exchangeCode'],
        'code_verifier' => str_repeat('x', 64),
    ])->assertUnprocessable()->assertJson(['error' => 'invalid_grant']);

    expect(DB::table('mobile_auth_codes')->where('id', $record['id'])->value('exchanged_at'))
        ->toBeNull()
        ->and($user->tokens()->count())->toBe(0);
});

test('exchange codes expire and can be used only once', function () {
    $user = User::factory()->create();
    $record = seedMobileAuthRecord([
        'user_id' => $user->id,
        'authorized_at' => now(),
        'exchange_expires_at' => now()->addMinutes(2),
    ]);
    $payload = [
        'code' => $record['exchangeCode'],
        'code_verifier' => $record['verifier'],
    ];

    $this->postJson('/api/mobile/auth/exchange', $payload)->assertOk();
    $this->postJson('/api/mobile/auth/exchange', $payload)
        ->assertUnprocessable()
        ->assertJson(['error' => 'invalid_grant']);

    $expired = seedMobileAuthRecord([
        'user_id' => $user->id,
        'authorized_at' => now(),
        'exchange_expires_at' => now()->subSecond(),
    ]);

    $this->postJson('/api/mobile/auth/exchange', [
        'code' => $expired['exchangeCode'],
        'code_verifier' => $expired['verifier'],
    ])->assertUnprocessable()->assertJson(['error' => 'invalid_grant']);

    expect($user->tokens()->count())->toBe(1);
});

test('mobile user requires a bearer token and returns a safe user shape', function () {
    $user = User::factory()->create(['google_id' => 'private-google-id']);
    $token = $user->createToken('mobile:test', ['mobile'])->plainTextToken;
    $wrongAbility = $user->createToken('browser:test', ['browser'])->plainTextToken;
    $wildcard = $user->createToken('mobile:wildcard')->plainTextToken;
    $expired = $user->createToken('mobile:expired', ['mobile'], now()->subSecond())->plainTextToken;

    $this->getJson('/api/mobile/user')->assertUnauthorized();
    $this->actingAs($user)->getJson('/api/mobile/user')->assertUnauthorized();
    $this->getJson('/api/mobile/user', ['Authorization' => 'Bearer '.$wrongAbility])
        ->assertUnauthorized();
    $this->getJson('/api/mobile/user', ['Authorization' => 'Bearer '.$wildcard])
        ->assertUnauthorized();
    $this->getJson('/api/mobile/user', ['Authorization' => 'Bearer '.$expired])
        ->assertUnauthorized();
    $this->getJson('/api/mobile/user', ['Authorization' => 'Bearer '.$token])
        ->assertOk()
        ->assertJsonPath('user.email', $user->email)
        ->assertJsonMissingPath('user.google_id')
        ->assertJsonMissingPath('user.password');
});

test('mobile user rejects a banned account and revokes its current token', function () {
    $user = User::factory()->create(['is_banned' => true]);
    $token = $user->createToken('mobile:test', ['mobile'])->plainTextToken;
    $user->createToken('mobile:other-device', ['mobile']);

    $this->getJson('/api/mobile/user', ['Authorization' => 'Bearer '.$token])
        ->assertForbidden()
        ->assertJson(['error' => 'account_disabled']);

    expect($user->tokens()->count())->toBe(0);
});

test('mobile logout revokes only the bearer token used for the request', function () {
    $user = User::factory()->create();
    $first = $user->createToken('mobile:first', ['mobile'])->plainTextToken;
    $user->createToken('mobile:second', ['mobile']);

    $this->postJson('/api/mobile/logout', [], ['Authorization' => 'Bearer '.$first])
        ->assertOk()
        ->assertJson(['message' => 'Logged out']);

    expect($user->tokens()->count())->toBe(1)
        ->and($user->tokens()->first()->name)->toBe('mobile:second');

    $this->getJson('/api/mobile/user', ['Authorization' => 'Bearer '.$first])
        ->assertUnauthorized();
});

test('the existing web Google login keeps its configured browser callback', function () {
    $this->get('/api/mobile/auth/google?'.http_build_query([
        'redirect_uri' => 'syrianzone://auth/callback',
        'state' => 'state_'.str_repeat('a', 48),
        'code_challenge' => mobileAuthChallenge(mobileAuthVerifier()),
        'code_challenge_method' => 'S256',
    ]))->assertRedirect();

    $response = $this->get('/auth/google');

    $response->assertRedirect();
    parse_str((string) parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);

    expect($query['redirect_uri'] ?? null)->toBe('https://example.test/auth/google/callback');
});
