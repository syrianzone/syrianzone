<?php

use App\Models\User;
use App\Support\Agents\TokenIssuer;
use Illuminate\Support\Facades\Date;

/*
|--------------------------------------------------------------------------
| The HTTP edge
|--------------------------------------------------------------------------
|
| /mcp/* is registered outside the web and api middleware groups, so none of
| the session/CSRF/cookie machinery applies and a real bearer token is the only
| way in. These tests pin that, because the failure mode — a logged-in admin's
| cookie silently authenticating as an agent — is invisible until an audit.
|
*/

beforeEach(function () {
    config()->set('mcp.enabled', true);
});

test('the mcp endpoint only exists when MCP_ENABLED is set', function () {
    // The flag is read while routes/ai.php is evaluated at boot, so a runtime
    // config change cannot unregister the route. Boot a real process instead.
    $base = base_path();

    // Both sides are set explicitly: the suite's own MCP_ENABLED=true would
    // otherwise be inherited by the child process through the environment.
    $off = shell_exec("cd {$base} && MCP_ENABLED=false php artisan route:list --path=mcp 2>&1");
    $on = shell_exec("cd {$base} && MCP_ENABLED=true php artisan route:list --path=mcp 2>&1");

    expect($off)->not->toContain('mcp/admin')
        ->and($on)->toContain('mcp/admin');
});

test('a guest is rejected', function () {
    $this->postJson('/mcp/admin', [
        'jsonrpc' => '2.0',
        'id' => 1,
        'method' => 'tools/list',
    ])->assertUnauthorized();
});

test('a session cookie is not accepted in place of a bearer token', function () {
    $admin = User::factory()->create(['role' => 'superadmin']);

    $this->actingAs($admin)
        ->postJson('/mcp/admin', [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'tools/list',
        ])
        // auth:sanctum accepts the session, RequireApiToken refuses it.
        ->assertForbidden()
        ->assertJsonPath('error', fn ($message) => str_contains($message, 'bearer API token'));
});

test('a valid bearer token passes the middleware stack', function () {
    $admin = User::factory()->create(['role' => 'superadmin']);
    $token = app(TokenIssuer::class)->issue($admin, 'ok', ['places.review'])['token'];

    $this->withHeader('Authorization', 'Bearer '.$token->plainTextToken)
        ->postJson('/mcp/admin', [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'tools/list',
        ])
        ->assertOk()
        ->assertJsonPath('result.tools', fn ($tools) => is_array($tools));
});

test('tools/list advertises only what the token can actually call', function () {
    // End-to-end proof that shouldRegister() gates the advertised catalogue:
    // places.review must yield the read tools and nothing else, and the
    // catalogue search tools must still be present for the write tools.
    $staff = User::factory()->create([
        'role' => 'user',
        'permissions' => ['places.review'],
    ]);
    $token = app(TokenIssuer::class)->issue($staff, 'reviewer', ['places.review'])['token'];

    $response = $this->withHeader('Authorization', 'Bearer '.$token->plainTextToken)
        ->postJson('/mcp/admin', [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'tools/list',
        ])
        ->assertOk()
        ->json('result.tools');

    $names = collect($response)->pluck('name');

    expect($names)->toContain('list-places', 'get-place', 'search_tools', 'execute_tools')
        // review-only: none of the write tools may be advertised
        ->and($names)->not->toContain('approve-place', 'reject-place', 'delete-place', 'update-place');
});

test('a superadmin token with every capability sees the full catalogue', function () {
    $super = User::factory()->create(['role' => 'superadmin']);
    $token = app(TokenIssuer::class)->issue($super, 'full', ['places.approve', 'places.edit', 'places.delete', 'places.moderate_photos', 'places.review'])['token'];

    $names = collect(
        $this->withHeader('Authorization', 'Bearer '.$token->plainTextToken)
            ->postJson('/mcp/admin', ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/list'])
            ->assertOk()
            ->json('result.tools')
    )->pluck('name');

    // Read tools are advertised directly; write tools live in the searchable
    // catalogue, so they are reachable via search_tools rather than listed.
    expect($names)->toContain('list-places', 'get-place', 'search_tools', 'execute_tools');
});

test('a banned owner is rejected even with a live token', function () {
    $admin = User::factory()->create(['role' => 'superadmin']);
    $token = app(TokenIssuer::class)->issue($admin, 'banned', ['places.review'])['token'];

    $admin->update(['is_banned' => true]);

    $this->withHeader('Authorization', 'Bearer '.$token->plainTextToken)
        ->postJson('/mcp/admin', [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'tools/list',
        ])
        ->assertForbidden()
        ->assertJsonPath('error', 'This account is banned.');
});

test('an expired token is rejected by sanctum', function () {
    $admin = User::factory()->create(['role' => 'superadmin']);
    $plain = app(TokenIssuer::class)->issue($admin, 'stale', ['places.review'])['token']->plainTextToken;

    // Backdate the expiry rather than waiting for the TTL.
    $admin->tokens()->update(['expires_at' => Date::now()->subDay()]);

    // 401, not 403: Sanctum's own guard rejects the expired token before
    // RequireApiToken runs. The middleware's expiry branch is a backstop for
    // the case where Sanctum's expiration handling is ever relaxed.
    $this->withHeader('Authorization', 'Bearer '.$plain)
        ->postJson('/mcp/admin', [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'tools/list',
        ])
        ->assertUnauthorized();
});

test('a revoked token is rejected', function () {
    $admin = User::factory()->create(['role' => 'superadmin']);
    $plain = app(TokenIssuer::class)->issue($admin, 'revoked', ['places.review'])['token']->plainTextToken;

    $admin->tokens()->delete();

    $this->withHeader('Authorization', 'Bearer '.$plain)
        ->postJson('/mcp/admin', [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'tools/list',
        ])
        ->assertUnauthorized();
});

test('a garbage bearer token is rejected', function () {
    $this->withHeader('Authorization', 'Bearer not-a-real-token')
        ->postJson('/mcp/admin', [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'tools/list',
        ])
        ->assertUnauthorized();
});
