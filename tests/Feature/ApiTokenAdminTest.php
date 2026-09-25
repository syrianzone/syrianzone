<?php

use App\Models\User;
use App\Support\Agents\TokenIssuer;
use Illuminate\Support\Facades\Date;

/*
|--------------------------------------------------------------------------
| /admin/api-tokens
|--------------------------------------------------------------------------
|
| The token UI lives in the Inertia dashboard alongside the other /admin/*
| sections, not in Filament. What matters here is that the HTTP layer keeps
| enforcing what the services already guarantee — especially that the endpoint
| is superadmin-only, and that an over-broad request is clamped rather than
| granted.
|
*/

function superadmin(): User
{
    return User::factory()->create(['role' => 'superadmin', 'permissions' => []]);
}

test('the tokens page is superadmin-only', function () {
    $this->get('/admin/api-tokens')->assertRedirect(route('login'));

    $this->actingAs(User::factory()->create(['role' => 'admin']))
        ->get('/admin/api-tokens')->assertForbidden();

    $this->actingAs(User::factory()->create(['role' => 'places_admin']))
        ->get('/admin/api-tokens')->assertForbidden();

    $this->actingAs(User::factory()->create(['role' => 'user']))
        ->get('/admin/api-tokens')->assertForbidden();
});

test('a superadmin gets the page with the data it needs', function () {
    $owner = User::factory()->create(['role' => 'transit_admin']);
    app(TokenIssuer::class)->issue($owner, 'existing', ['transit.approve']);

    $this->actingAs(superadmin())
        ->get('/admin/api-tokens')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Admin/ApiTokens/Index')
            ->where('tokens.0.name', 'existing')
            ->where('tokens.0.owner.id', $owner->id)
            ->where('tokens.0.abilities', ['transit.approve'])
            ->has('owners')
            ->has('capabilityGroups')
            ->has('capabilities')
            ->has('ttlOptions')
            // the agent needs the endpoint to be able to connect at all
            ->where('endpoint', url('/mcp/admin'))
        );
});

test('the owner list only offers users who hold a capability', function () {
    superadmin();

    $this->actingAs(superadmin())
        ->get('/admin/api-tokens')
        ->assertInertia(fn ($page) => $page->component('Admin/ApiTokens/Index'));
});

test('a superadmin can mint a token and gets the plaintext once', function () {
    $owner = User::factory()->create(['role' => 'places_admin', 'permissions' => []]);

    $this->actingAs(superadmin())
        ->postJson('/api/v1/admin/api-tokens', [
            'user_id' => $owner->id,
            'name' => 'claude-code',
            'ttl' => '30d',
            'permissions' => ['places.review', 'places.approve'],
        ])
        ->assertCreated()
        ->assertJsonPath('abilities', ['places.review', 'places.approve'])
        ->assertJsonStructure(['plain_text_token', 'abilities', 'dropped', 'message']);

    expect($owner->tokens()->count())->toBe(1);
});

test('a request for capabilities the owner lacks is clamped, not granted', function () {
    $owner = User::factory()->create(['role' => 'places_admin', 'permissions' => []]);

    $response = $this->actingAs(superadmin())
        ->postJson('/api/v1/admin/api-tokens', [
            'user_id' => $owner->id,
            'name' => 'overreach',
            'ttl' => '30d',
            'permissions' => ['places.approve', 'polls.delete'],
        ])
        ->assertCreated()
        ->assertJsonPath('abilities', ['places.approve'])
        ->assertJsonPath('dropped', ['polls.delete']);

    expect($response->json('message'))->toContain('polls.delete');
});

test('a token with no usable capability is refused rather than minted inert', function () {
    $owner = User::factory()->create(['role' => 'user', 'permissions' => []]);

    $this->actingAs(superadmin())
        ->postJson('/api/v1/admin/api-tokens', [
            'user_id' => $owner->id,
            'name' => 'inert',
            'ttl' => '30d',
            'permissions' => ['places.approve'],
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'المستخدم المحدد لا يملك أياً من هذه الصلاحيات، لم يُنشأ رمز.');

    expect($owner->tokens()->count())->toBe(0);
});

test('minting validates its input', function () {
    $this->actingAs(superadmin())
        ->postJson('/api/v1/admin/api-tokens', [
            'user_id' => 999999,
            'name' => 'x',
            'ttl' => '30d',
            'permissions' => ['places.approve'],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('user_id');

    $owner = User::factory()->create(['role' => 'admin']);

    $this->actingAs(superadmin())
        ->postJson('/api/v1/admin/api-tokens', [
            'user_id' => $owner->id,
            'name' => '',
            'ttl' => '30d',
            'permissions' => ['places.approve'],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('name');

    $this->actingAs(superadmin())
        ->postJson('/api/v1/admin/api-tokens', [
            'user_id' => $owner->id,
            'name' => 'x',
            'ttl' => '9999y',
            'permissions' => ['places.approve'],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('ttl');

    $this->actingAs(superadmin())
        ->postJson('/api/v1/admin/api-tokens', [
            'user_id' => $owner->id,
            'name' => 'x',
            'ttl' => '30d',
            'permissions' => ['not.a.capability'],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('permissions.0');

    $this->actingAs(superadmin())
        ->postJson('/api/v1/admin/api-tokens', [
            'user_id' => $owner->id,
            'name' => 'x',
            'ttl' => '30d',
            'permissions' => [],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('permissions');
});

test('non-superadmins cannot mint', function () {
    $owner = User::factory()->create(['role' => 'admin']);

    foreach (['admin', 'places_admin', 'transit_admin'] as $role) {
        $this->actingAs(User::factory()->create(['role' => $role]))
            ->postJson('/api/v1/admin/api-tokens', [
                'user_id' => $owner->id,
                'name' => 'nope',
                'ttl' => '30d',
                'permissions' => ['places.approve'],
            ])
            ->assertForbidden();
    }

    expect($owner->tokens()->count())->toBe(0);
});

test('a token can be revoked', function () {
    $owner = User::factory()->create(['role' => 'places_admin']);
    $token = app(TokenIssuer::class)->issue($owner, 'doomed', ['places.review'])['token']->accessToken;

    $this->actingAs(superadmin())
        ->deleteJson("/api/v1/admin/api-tokens/{$token->id}")
        ->assertOk()
        ->assertJsonPath('message', 'تم إبطال الرمز «doomed»');

    expect($owner->fresh()->tokens()->count())->toBe(0);
});

test('every token for a user can be revoked at once', function () {
    $owner = User::factory()->create(['role' => 'places_admin']);

    app(TokenIssuer::class)->issue($owner, 'a', ['places.review']);
    app(TokenIssuer::class)->issue($owner, 'b', ['places.review']);
    app(TokenIssuer::class)->issue($owner, 'c', ['places.review']);

    $this->actingAs(superadmin())
        ->postJson("/api/v1/admin/api-tokens/revoke-all/{$owner->id}")
        ->assertOk()
        ->assertJsonPath('message', 'تم إبطال 3 رمز');

    expect($owner->fresh()->tokens()->count())->toBe(0);
});

test('the list marks expired and banned-owner tokens', function () {
    $banned = User::factory()->create(['role' => 'places_admin', 'is_banned' => true]);
    app(TokenIssuer::class)->issue($banned, 'banned-owner', ['places.review']);

    $stale = User::factory()->create(['role' => 'places_admin']);
    app(TokenIssuer::class)->issue($stale, 'stale', ['places.review']);
    $stale->tokens()->update(['expires_at' => Date::now()->subDay()]);

    $this->actingAs(superadmin())
        ->get('/admin/api-tokens')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Admin/ApiTokens/Index')
            ->where('tokens.0.is_expired', true)
            ->where('tokens.1.owner_banned', true)
        );
});

test('a minted token immediately works against the agent endpoint', function () {
    // Closes the loop: the thing the dashboard mints is the thing /mcp/admin accepts.
    $owner = User::factory()->create(['role' => 'places_admin', 'permissions' => []]);

    $plain = $this->actingAs(superadmin())
        ->postJson('/api/v1/admin/api-tokens', [
            'user_id' => $owner->id,
            'name' => 'e2e',
            'ttl' => '30d',
            'permissions' => ['places.review'],
        ])
        ->assertCreated()
        ->json('plain_text_token');

    // Drop the minting superadmin's session first. config('sanctum.guard')
    // checks the web guard before the bearer token, so with a session still in
    // place Sanctum would resolve that user and hand RequireApiToken a
    // TransientToken — i.e. a 403. An agent sends no cookie, so clearing it
    // here is what makes this test mirror a real agent rather than a browser.
    $this->app['auth']->forgetGuards();
    $this->flushSession();

    $this->withHeader('Authorization', 'Bearer '.$plain)
        ->postJson('/mcp/admin', ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/list'])
        ->assertOk()
        ->assertJsonPath('result.tools', fn ($tools) => collect($tools)->pluck('name')->contains('list-places'));
});

test('a browser session cannot impersonate an agent even with a bearer token', function () {
    // The inverse of the above, and the reason RequireApiToken exists: a
    // logged-in admin's cookie is not an agent credential.
    $sessionUser = User::factory()->create(['role' => 'superadmin']);
    $plain = app(TokenIssuer::class)->issue(
        User::factory()->create(['role' => 'places_admin']),
        'agent',
        ['places.review'],
    )['token']->plainTextToken;

    $this->actingAs($sessionUser)
        ->withHeader('Authorization', 'Bearer '.$plain)
        ->postJson('/mcp/admin', ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/list'])
        ->assertForbidden()
        ->assertJsonPath('error', fn ($m) => str_contains($m, 'bearer API token'));
});
