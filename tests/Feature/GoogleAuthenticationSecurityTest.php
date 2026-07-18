<?php

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\GoogleProvider;
use Laravel\Socialite\Two\User as SocialiteUser;

function fakeWebGoogleAccount(string $email, string $subject = 'web-google-subject'): void
{
    $provider = Mockery::mock(GoogleProvider::class);
    $provider->shouldReceive('stateless')->once()->andReturnSelf();
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
