<?php

use App\Models\User;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\GoogleProvider;
use Laravel\Socialite\Two\User as SocialiteUser;

function configureStatefulWebGoogle(array $responses = []): void
{
    $handler = new MockHandler($responses);

    config([
        'services.google' => [
            'client_id' => 'web-google-client',
            'client_secret' => 'web-google-secret',
            'redirect' => 'http://localhost/auth/google/callback',
            'guzzle' => ['handler' => HandlerStack::create($handler)],
        ],
    ]);

    Socialite::forgetDrivers();
}

function statefulWebGoogleResponses(
    string $subject = 'state-check-subject',
    string $email = 'state-check@example.test',
): array {
    return [
        new Response(200, ['Content-Type' => 'application/json'], json_encode([
            'access_token' => 'web-access-token',
            'token_type' => 'Bearer',
        ], JSON_THROW_ON_ERROR)),
        new Response(200, ['Content-Type' => 'application/json'], json_encode([
            'sub' => $subject,
            'name' => 'Stateful Google User',
            'email' => $email,
            'picture' => 'https://images.example.test/stateful.png',
        ], JSON_THROW_ON_ERROR)),
    ];
}

function fakeWebGoogleAccount(string $email, string $subject = 'web-google-subject'): void
{
    $provider = Mockery::mock(GoogleProvider::class);
    $provider->shouldReceive('user')->once()->andReturn(
        (new SocialiteUser)->setRaw([])->map([
            'id' => $subject,
            'name' => 'Web Google User',
            'email' => $email,
            'avatar' => 'https://images.example.test/google-avatar.png',
        ]),
    );
    Socialite::shouldReceive('driver')->with('google')->once()->andReturn($provider);
}

test('web Google redirect stores only same origin paths', function (string $redirect, ?string $intended) {
    configureStatefulWebGoogle();

    $response = $this->get('/auth/google?'.http_build_query(['redirect' => $redirect]));
    $response->assertRedirect();

    if ($intended === null) {
        $response->assertSessionMissing('url.intended');

        return;
    }

    $response->assertSessionHas('url.intended', $intended);
})->with([
    'absolute URL' => ['https://attacker.example/path', null],
    'network path' => ['//attacker.example/path', null],
    'backslash network path' => ['\\attacker.example/path', null],
    'encoded network path' => ['/%2Fattacker.example/path', null],
    'double encoded backslash path' => ['%255Cattacker.example/path', null],
    'control character' => ["/transit/studio\r\nX-Test: injected", null],
    'local path' => ['/transit/studio?tab=drafts#review', '/transit/studio?tab=drafts#review'],
    'local path without slash' => ['transit/studio', '/transit/studio'],
]);

test('web Google callback rejects a missing state before contacting Google', function () {
    configureStatefulWebGoogle(statefulWebGoogleResponses(
        'missing-state-subject',
        'missing-state@example.test',
    ));

    $this->get('/auth/google/callback?code=missing-state')
        ->assertRedirect('/?error=auth_failed');

    $this->assertGuest();
    expect(User::query()->count())->toBe(0);
});

test('web Google callback rejects an invalid state before contacting Google', function () {
    configureStatefulWebGoogle(statefulWebGoogleResponses(
        'invalid-state-subject',
        'invalid-state@example.test',
    ));

    $response = $this->get('/auth/google')->assertRedirect();
    parse_str((string) parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);

    expect($query['state'] ?? null)->toBeString()->not->toBe('');

    Socialite::forgetDrivers();
    $this->get('/auth/google/callback?'.http_build_query([
        'code' => 'invalid-state',
        'state' => 'not-the-issued-state',
    ]))->assertRedirect('/?error=auth_failed');

    $this->assertGuest();
    expect(User::query()->count())->toBe(0);
});

test('web Google callback consumes a valid state and rejects its replay', function () {
    configureStatefulWebGoogle(array_merge(
        statefulWebGoogleResponses('stateful-google-subject', 'stateful@example.test'),
        statefulWebGoogleResponses('stateful-google-subject', 'stateful@example.test'),
    ));

    $response = $this->get('/auth/google')->assertRedirect();
    parse_str((string) parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);
    $state = $query['state'] ?? null;

    expect($state)->toBeString()->not->toBe('');

    Socialite::forgetDrivers();
    $this->get('/auth/google/callback?'.http_build_query([
        'code' => 'valid-state',
        'state' => $state,
    ]))->assertRedirect('/dashboard');

    expect(User::where('google_id', 'stateful-google-subject')->exists())->toBeTrue();

    Socialite::forgetDrivers();
    $this->get('/auth/google/callback?'.http_build_query([
        'code' => 'replayed-state',
        'state' => $state,
    ]))->assertRedirect('/?error=auth_failed');
});

test('web Google login creates an unknown account with the regular user role', function () {
    fakeWebGoogleAccount('new-user@example.test');

    $this->get('/auth/google/callback')->assertRedirect('/dashboard');

    $user = User::where('email', 'new-user@example.test')->firstOrFail();
    expect($user->role)->toBe('user')
        ->and($user->google_id)->toBe('web-google-subject')
        ->and(Auth::id())->toBe($user->id);
});

test('web Google login rejects banned accounts without changing them', function () {
    $user = User::factory()->create([
        'avatar_url' => 'https://images.example.test/original.png',
        'email' => 'banned-web@example.test',
        'google_id' => 'web-google-subject',
        'is_banned' => true,
        'role' => 'admin',
    ]);
    fakeWebGoogleAccount($user->email);

    $this->get('/auth/google/callback')->assertRedirect('/?error=access_denied');

    $this->assertGuest();
    expect($user->fresh()->avatar_url)->toBe('https://images.example.test/original.png')
        ->and($user->fresh()->role)->toBe('admin');
});

test('web Google login never restores a legacy soft-deleted account', function () {
    $user = User::factory()->create([
        'email' => 'deleted-web@example.test',
        'google_id' => 'web-google-subject',
        'role' => 'admin',
    ]);
    $user->delete();
    fakeWebGoogleAccount('deleted-web@example.test');

    $this->get('/auth/google/callback')->assertRedirect('/?error=access_denied');

    $this->assertGuest();
    expect(User::withTrashed()->findOrFail($user->id)->trashed())->toBeTrue()
        ->and(User::where('email', 'deleted-web@example.test')->exists())->toBeFalse();
});

test('web Google login rejects a different subject for a linked email', function () {
    $user = User::factory()->create([
        'email' => 'linked-web@example.test',
        'google_id' => 'original-subject',
        'role' => 'admin',
    ]);
    fakeWebGoogleAccount($user->email, 'attacker-subject');

    $this->get('/auth/google/callback')->assertRedirect('/?error=access_denied');

    $this->assertGuest();
    expect($user->fresh()->google_id)->toBe('original-subject');
});

test('banned web sessions cannot reach any privileged role route', function (string $role, string $uri) {
    $user = User::factory()->create([
        'is_banned' => true,
        'role' => $role,
    ]);

    $this->actingAs($user)
        ->getJson($uri)
        ->assertForbidden()
        ->assertExactJson(['error' => 'account_disabled']);

    $this->assertGuest();
})->with([
    'administrator' => ['admin', '/admin/polls'],
    'transit administrator' => ['transit_admin', '/transit/admin'],
    'superadmin' => ['superadmin', '/api/admins'],
]);

test('banning an account revokes every API token and stored web session', function () {
    $user = User::factory()->create(['is_banned' => false]);
    $user->createToken('mobile:first', ['mobile']);
    $user->createToken('mobile:second', ['mobile']);
    DB::table('sessions')->insert([
        'id' => 'session-for-banned-user',
        'ip_address' => '127.0.0.1',
        'last_activity' => now()->timestamp,
        'payload' => 'test-session',
        'user_agent' => 'Pest',
        'user_id' => $user->id,
    ]);

    $user->update(['is_banned' => true]);

    expect($user->tokens()->count())->toBe(0)
        ->and(DB::table('sessions')->where('user_id', $user->id)->exists())->toBeFalse();
});

test('unbanning an account does not revoke a newly established session', function () {
    $user = User::factory()->create(['is_banned' => true]);
    $user->createToken('mobile:new', ['mobile']);
    DB::table('sessions')->insert([
        'id' => 'session-for-unbanned-user',
        'ip_address' => '127.0.0.1',
        'last_activity' => now()->timestamp,
        'payload' => 'test-session',
        'user_agent' => 'Pest',
        'user_id' => $user->id,
    ]);

    $user->update(['is_banned' => false]);

    expect($user->tokens()->count())->toBe(1)
        ->and(DB::table('sessions')->where('user_id', $user->id)->exists())->toBeTrue();
});
