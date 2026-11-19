<?php

use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

// The token exchange must only accept Google tokens issued to one of our own
// client ids. Every way of failing to establish that is a refusal.

const OUR_CLIENT = 'our-client.apps.googleusercontent.com';

beforeEach(function () {
    Config::set('services.google.allowed_client_ids', [OUR_CLIENT]);
});

function fakeUserInfo(string $sub = 'google-sub-1'): array
{
    return [
        'https://www.googleapis.com/oauth2/v3/userinfo' => Http::response([
            'sub' => $sub,
            'email' => 'person@example.com',
            'email_verified' => true,
            'name' => 'Person',
        ]),
    ];
}

test('an access token issued to our client signs in', function () {
    Http::fake([
        'https://oauth2.googleapis.com/tokeninfo*' => Http::response(['aud' => OUR_CLIENT, 'sub' => 'google-sub-1']),
        ...fakeUserInfo(),
    ]);

    $this->postJson('/api/v1/auth/google/token', ['access_token' => 'tok'])
        ->assertOk()
        ->assertJsonPath('user.email', 'person@example.com');
});

test('an access token issued to another app is refused', function () {
    Http::fake([
        'https://oauth2.googleapis.com/tokeninfo*' => Http::response(['aud' => 'someone-else.apps.googleusercontent.com', 'sub' => 'google-sub-1']),
        ...fakeUserInfo(),
    ]);

    $this->postJson('/api/v1/auth/google/token', ['access_token' => 'tok'])->assertStatus(401);
    expect(User::where('email', 'person@example.com')->exists())->toBeFalse();
});

test('an access token whose audience tokeninfo does not report is refused', function () {
    Http::fake([
        'https://oauth2.googleapis.com/tokeninfo*' => Http::response(['sub' => 'google-sub-1']),
        ...fakeUserInfo(),
    ]);

    $this->postJson('/api/v1/auth/google/token', ['access_token' => 'tok'])->assertStatus(401);
});

test('an access token tokeninfo rejects is refused even when userinfo accepts it', function () {
    Http::fake([
        'https://oauth2.googleapis.com/tokeninfo*' => Http::response(['error' => 'invalid_token'], 400),
        ...fakeUserInfo(),
    ]);

    $this->postJson('/api/v1/auth/google/token', ['access_token' => 'tok'])->assertStatus(401);
});

test('an access token is refused when tokeninfo is unreachable', function () {
    Http::fake([
        'https://oauth2.googleapis.com/tokeninfo*' => fn () => throw new ConnectionException('unreachable'),
        ...fakeUserInfo(),
    ]);

    $this->postJson('/api/v1/auth/google/token', ['access_token' => 'tok'])->assertStatus(503);
    expect(User::where('email', 'person@example.com')->exists())->toBeFalse();
});

test('an access token is refused when tokeninfo and userinfo describe different accounts', function () {
    Http::fake([
        'https://oauth2.googleapis.com/tokeninfo*' => Http::response(['aud' => OUR_CLIENT, 'sub' => 'google-sub-1']),
        ...fakeUserInfo('google-sub-2'),
    ]);

    $this->postJson('/api/v1/auth/google/token', ['access_token' => 'tok'])->assertStatus(401);
});

test('no Google token is accepted when no client ids are configured', function () {
    Config::set('services.google.allowed_client_ids', []);
    Http::fake([
        'https://oauth2.googleapis.com/tokeninfo*' => Http::response([
            'aud' => 'anything.apps.googleusercontent.com',
            'sub' => 'google-sub-1',
            'email' => 'person@example.com',
            'email_verified' => 'true',
        ]),
        ...fakeUserInfo(),
    ]);

    $this->postJson('/api/v1/auth/google/token', ['access_token' => 'tok'])->assertStatus(503);
    $this->postJson('/api/v1/auth/google/token', ['id_token' => 'tok'])->assertStatus(503);
    expect(User::where('email', 'person@example.com')->exists())->toBeFalse();
});
