<?php

use App\Models\User;
use App\Support\Agents\AgentContext;
use App\Support\Agents\TokenIssuer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Mcp\Request as McpRequest;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature', 'Unit');

/*
|--------------------------------------------------------------------------
| Agent / MCP test helpers
|--------------------------------------------------------------------------
|
| The MCP package's test entrypoint (AdminServer::tool(...)) resolves the
| container but runs no HTTP middleware, so the AgentContext that
| RequireApiToken normally binds has to be installed by hand. Routing every
| test through one helper keeps them authenticating the same way, and mirrors
| what a real bearer-token request produces.
|
*/

function agentUser(array $attributes = []): User
{
    return User::factory()->create($attributes + ['role' => 'user']);
}

/**
 * Mint a token for $user and bind the AgentContext RequireApiToken would bind.
 *
 * @param  array<int, string>  $abilities
 */
function agentToken(User $user, array $abilities, string $ttl = '30d'): PersonalAccessToken
{
    $issued = app(TokenIssuer::class)->issue(
        owner: $user,
        name: 'test-agent',
        abilities: $abilities,
        ttl: $ttl,
    );

    $token = $issued['token']->accessToken;

    app()->instance(AgentContext::class, AgentContext::for($user, $token));

    return $token;
}

/**
 * Invoke a tool's handle() the same way the MCP ToolInvoker does.
 *
 * Needed because the write tools live in a ToolSearch catalogue, and
 * catalogue tools are reached through execute_tools rather than tools/call.
 * The package's test helper only accepts primitive class names, so it cannot
 * express that two-hop call; driving handle() directly covers the same code
 * path the invoker takes. Registration and permission gating are asserted
 * separately over real HTTP in AgentHttpTest.
 *
 * @template T of \Laravel\Mcp\Server\Tool
 *
 * @param  class-string<T>  $tool
 * @param  array<string, mixed>  $arguments
 * @return Response|ResponseFactory
 */
function callTool(string $tool, array $arguments = [])
{
    return app()->call([app($tool), 'handle'], ['request' => new McpRequest($arguments)]);
}

/**
 * Structured payload of a tool response, or null when it is a bare Response.
 *
 * @return array<string, mixed>|null
 */
function toolPayload(Response|ResponseFactory $response): ?array
{
    return $response instanceof Response ? null : $response->getStructuredContent();
}

/**
 * Concatenated text of a tool response, for asserting on error messages.
 */
function toolText(Response|ResponseFactory $response): string
{
    $responses = $response instanceof Response ? [$response] : $response->responses()->all();

    return collect($responses)
        ->map(fn (Response $item) => (string) $item->content())
        ->implode(' ');
}
