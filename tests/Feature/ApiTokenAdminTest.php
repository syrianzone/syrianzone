<?php

use App\Models\User;
use App\Support\Agents\TokenIssuer;
use Illuminate\Support\Facades\Date;
use Laravel\Sanctum\PersonalAccessToken;

/*
|--------------------------------------------------------------------------
| /admin/api-tokens
|--------------------------------------------------------------------------
|
| The token UI lives in the Inertia dashboard alongside the other /admin/*
| sections, not in Filament. What matters here is that the HTTP layer keeps
| enforcing what the services already guarantee: a superadmin manages every
| token, any other capability holder manages only their own, an over-broad
| request is clamped rather than granted, and an API token can never be used to
| mint another one.
|
*/

test('the tokens page needs a capability, not a role', function () {
    $this->get('/admin/api-tokens')->assertRedirect(route('login'));

    // Neither role grants anything any more, so neither holds a capability.
    $this->actingAs(User::factory()->create(['role' => 'admin', 'permissions' => []]))
        ->get('/admin/api-tokens')->assertForbidden();

    $this->actingAs(User::factory()->create(['role' => 'user', 'permissions' => []]))
        ->get('/admin/api-tokens')->assertForbidden();

    $this->actingAs(moduleStaff('places', ['is_banned' => true]))
        ->get('/admin/api-tokens')->assertForbidden();

    $this->actingAs(moduleStaff('places'))
        ->get('/admin/api-tokens')->assertOk();
});

test('a superadmin gets the page with the data it needs', function () {
    // (superadmin mode: every token, every eligible owner, the whole catalogue)
    $owner = moduleStaff('transit');
    app(TokenIssuer::class)->issue($owner, 'existing', ['transit.approve']);

    $this->actingAs(User::factory()->superadmin()->create())
        ->get('/admin/api-tokens')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Admin/ApiTokens/Index')
            ->where('tokens.0.name', 'existing')
            ->where('tokens.0.owner.id', $owner->id)
            ->where('tokens.0.abilities', ['transit.approve'])
            ->where('selfService', false)
            ->has('owners')
            ->has('capabilityGroups')
            ->has('capabilities')
            ->has('ttlOptions')
            // the agent needs the endpoint to be able to connect at all
            ->where('endpoint', url('/mcp/admin'))
        );
});

test('the owner list only offers users who hold a capability', function () {
    User::factory()->superadmin()->create();

    $this->actingAs(User::factory()->superadmin()->create())
        ->get('/admin/api-tokens')
        ->assertInertia(fn ($page) => $page->component('Admin/ApiTokens/Index'));
});

test('a superadmin can mint a token and gets the plaintext once', function () {
    $owner = moduleStaff('places');

    $this->actingAs(User::factory()->superadmin()->create())
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
    $owner = moduleStaff('places');

    $response = $this->actingAs(User::factory()->superadmin()->create())
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

    $this->actingAs(User::factory()->superadmin()->create())
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
    $this->actingAs(User::factory()->superadmin()->create())
        ->postJson('/api/v1/admin/api-tokens', [
            'user_id' => 999999,
            'name' => 'x',
            'ttl' => '30d',
            'permissions' => ['places.approve'],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('user_id');

    $owner = User::factory()->create(['role' => 'admin']);

    $this->actingAs(User::factory()->superadmin()->create())
        ->postJson('/api/v1/admin/api-tokens', [
            'user_id' => $owner->id,
            'name' => '',
            'ttl' => '30d',
            'permissions' => ['places.approve'],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('name');

    $this->actingAs(User::factory()->superadmin()->create())
        ->postJson('/api/v1/admin/api-tokens', [
            'user_id' => $owner->id,
            'name' => 'x',
            'ttl' => '9999y',
            'permissions' => ['places.approve'],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('ttl');

    $this->actingAs(User::factory()->superadmin()->create())
        ->postJson('/api/v1/admin/api-tokens', [
            'user_id' => $owner->id,
            'name' => 'x',
            'ttl' => '30d',
            'permissions' => ['not.a.capability'],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('permissions.0');

    $this->actingAs(User::factory()->superadmin()->create())
        ->postJson('/api/v1/admin/api-tokens', [
            'user_id' => $owner->id,
            'name' => 'x',
            'ttl' => '30d',
            'permissions' => [],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('permissions');
});

test('accounts without any capability cannot mint', function () {
    $owner = User::factory()->create(['role' => 'admin']);

    foreach (['admin', 'places_admin', 'transit_admin'] as $role) {
        $this->actingAs(User::factory()->create(['role' => $role, 'permissions' => []]))
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

/*
|--------------------------------------------------------------------------
| Self-service: a capability holder managing their own tokens
|--------------------------------------------------------------------------
*/

test('a capability holder sees only their own tokens and their own capabilities', function () {
    $staff = moduleStaff('places');
    app(TokenIssuer::class)->issue($staff, 'mine', ['places.review']);
    app(TokenIssuer::class)->issue(moduleStaff('transit'), 'someone-else', ['transit.approve']);

    $this->actingAs($staff)
        ->get('/admin/api-tokens')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Admin/ApiTokens/Index')
            ->where('selfService', true)
            ->has('tokens', 1)
            ->where('tokens.0.name', 'mine')
            ->has('owners', 1)
            ->where('owners.0.id', $staff->id)
            // only the places group, and only what the account holds in it
            ->has('capabilities', 1)
            ->has('capabilities.places')
            ->missing('capabilities.transit')
        );
});

test('a capability holder mints a token for themselves, clamped to what they hold', function () {
    $staff = User::factory()->create(['role' => 'user', 'permissions' => ['places.review']]);

    $this->actingAs($staff)
        ->postJson('/api/v1/admin/api-tokens', [
            'name' => 'my-agent',
            'ttl' => '30d',
            'permissions' => ['places.review', 'places.delete', 'polls.delete'],
        ])
        ->assertCreated()
        ->assertJsonPath('abilities', ['places.review'])
        ->assertJsonPath('dropped', ['places.delete', 'polls.delete']);

    expect($staff->tokens()->sole()->abilities)->toBe(['places.review']);
});

test('a capability holder cannot mint a token for someone else', function () {
    $staff = moduleStaff('places');
    $other = moduleStaff('places');

    $this->actingAs($staff)
        ->postJson('/api/v1/admin/api-tokens', [
            'user_id' => $other->id,
            'name' => 'not-mine',
            'ttl' => '30d',
            'permissions' => ['places.review'],
        ])
        ->assertForbidden();

    expect($other->tokens()->count())->toBe(0)
        ->and($staff->tokens()->count())->toBe(0);
});

test('a capability holder revokes only their own agent tokens', function () {
    $staff = moduleStaff('places');
    $own = app(TokenIssuer::class)->issue($staff, 'mine', ['places.review'])['token']->accessToken;
    $mobile = $staff->createToken('phone', ['mobile'])->accessToken;
    $foreign = app(TokenIssuer::class)->issue(moduleStaff('places'), 'theirs', ['places.review'])['token']->accessToken;

    $this->actingAs($staff)->deleteJson("/api/v1/admin/api-tokens/{$foreign->id}")->assertNotFound();
    // a mobile app session is not an agent token, so this page cannot end it
    $this->actingAs($staff)->deleteJson("/api/v1/admin/api-tokens/{$mobile->id}")->assertNotFound();
    $this->actingAs($staff)->deleteJson("/api/v1/admin/api-tokens/{$own->id}")->assertOk();

    expect(PersonalAccessToken::find($own->id))->toBeNull()
        ->and(PersonalAccessToken::find($mobile->id))->not->toBeNull()
        ->and(PersonalAccessToken::find($foreign->id))->not->toBeNull();
});

test('revoking every token of a user stays superadmin-only', function () {
    $staff = moduleStaff('places');
    app(TokenIssuer::class)->issue($staff, 'mine', ['places.review']);

    $this->actingAs($staff)
        ->postJson("/api/v1/admin/api-tokens/revoke-all/{$staff->id}")
        ->assertForbidden();

    expect($staff->tokens()->count())->toBe(1);
});

test('an API token cannot be used to mint another token', function () {
    // Otherwise a narrow agent token could mint itself one carrying everything
    // its owner holds, escaping its own ceiling. Holds for superadmins too.
    foreach ([moduleStaff('places'), User::factory()->superadmin()->create()] as $owner) {
        $plain = app(TokenIssuer::class)->issue($owner, 'narrow', ['places.review'])['token']->plainTextToken;

        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->postJson('/api/v1/admin/api-tokens', [
                'user_id' => $owner->id,
                'name' => 'wider',
                'ttl' => '30d',
                'permissions' => ['places.review', 'places.delete'],
            ])
            ->assertForbidden();

        expect($owner->tokens()->count())->toBe(1);
    }
});

test('a token can be revoked', function () {
    $owner = moduleStaff('places');
    $token = app(TokenIssuer::class)->issue($owner, 'doomed', ['places.review'])['token']->accessToken;

    $this->actingAs(User::factory()->superadmin()->create())
        ->deleteJson("/api/v1/admin/api-tokens/{$token->id}")
        ->assertOk()
        ->assertJsonPath('message', 'تم إبطال الرمز «doomed»');

    expect($owner->fresh()->tokens()->count())->toBe(0);
});

test('every token for a user can be revoked at once', function () {
    $owner = moduleStaff('places');

    app(TokenIssuer::class)->issue($owner, 'a', ['places.review']);
    app(TokenIssuer::class)->issue($owner, 'b', ['places.review']);
    app(TokenIssuer::class)->issue($owner, 'c', ['places.review']);

    $this->actingAs(User::factory()->superadmin()->create())
        ->postJson("/api/v1/admin/api-tokens/revoke-all/{$owner->id}")
        ->assertOk()
        ->assertJsonPath('message', 'تم إبطال 3 رمز');

    expect($owner->fresh()->tokens()->count())->toBe(0);
});

test('the list marks expired and banned-owner tokens', function () {
    $banned = moduleStaff('places', ['is_banned' => true]);
    app(TokenIssuer::class)->issue($banned, 'banned-owner', ['places.review']);

    $stale = moduleStaff('places');
    app(TokenIssuer::class)->issue($stale, 'stale', ['places.review']);
    $stale->tokens()->update(['expires_at' => Date::now()->subDay()]);

    $this->actingAs(User::factory()->superadmin()->create())
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
    $owner = moduleStaff('places');

    $plain = $this->actingAs(User::factory()->superadmin()->create())
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
        moduleStaff('places'),
        'agent',
        ['places.review'],
    )['token']->plainTextToken;

    $this->actingAs($sessionUser)
        ->withHeader('Authorization', 'Bearer '.$plain)
        ->postJson('/mcp/admin', ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/list'])
        ->assertForbidden()
        ->assertJsonPath('error', fn ($m) => str_contains($m, 'bearer API token'));
});
