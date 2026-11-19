<?php

use App\Models\User;
use App\Support\Agents\TokenIssuer;

// An agent token's capability ceiling is enforced by the MCP gate only.
// Anywhere else Sanctum would resolve the owner with their full rights, so an
// agent token must not authenticate outside the MCP endpoint at all.

function narrowAgentToken(User $owner): string
{
    return app(TokenIssuer::class)->issue($owner, 'narrow', ['places.review'])['token']->plainTextToken;
}

test('an agent token cannot read admin endpoints outside MCP', function () {
    $owner = User::factory()->superadmin()->create();

    $this->withToken(narrowAgentToken($owner))
        ->getJson('/api/v1/admin/route-drafts')
        ->assertUnauthorized();
});

test('an agent token cannot delete its owner\'s account', function () {
    $owner = User::factory()->superadmin()->create();

    $this->withToken(narrowAgentToken($owner))
        ->deleteJson('/api/v1/account')
        ->assertUnauthorized();

    expect($owner->fresh()->trashed())->toBeFalse();
});

test('an agent token cannot change its owner\'s account', function () {
    $owner = User::factory()->create(['name' => 'Original', 'email' => 'owner@example.com']);

    $this->withToken(narrowAgentToken($owner))
        ->patchJson('/api/v1/account', ['name' => 'Changed', 'email' => 'attacker@example.com'])
        ->assertUnauthorized();

    expect($owner->fresh()->email)->toBe('owner@example.com');
});

test('an agent token still authenticates on the MCP endpoint', function () {
    $owner = User::factory()->superadmin()->create();

    $this->withToken(narrowAgentToken($owner))
        ->postJson('/mcp/admin', ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/list'])
        ->assertOk();
})->skip(fn () => ! config('mcp.enabled'), 'MCP is disabled in this environment');

test('a phone session token still authenticates on user endpoints', function () {
    $user = User::factory()->create();
    $token = $user->createToken('phone', ['mobile'])->plainTextToken;

    $this->withToken($token)->getJson('/api/v1/user')->assertOk()->assertJsonPath('id', $user->id);
});
