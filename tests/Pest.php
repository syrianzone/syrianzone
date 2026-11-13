<?php

use App\Models\User;
use App\Support\Agents\AgentContext;
use App\Support\Agents\TokenIssuer;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
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
 * An account holding exactly the given capabilities, optionally narrowed to the
 * governorates it may act in (transit is the only scoped module).
 *
 * Access is the capability list and nothing else, so a fixture that grants
 * access says which capabilities it grants: `role` stays `user` unless a test
 * is specifically about a role string.
 *
 * @param  string|array<int, string>  $capabilities
 * @param  array<int, string>|null  $transitCities
 */
function capabilityUser(string|array $capabilities, ?array $transitCities = null): User
{
    return User::factory()->withPermissions((array) $capabilities)->create([
        'permission_scopes' => $transitCities === null ? null : ['transit' => $transitCities],
    ]);
}

/**
 * A staff account scoped to exactly one module: a `user` holding the module's
 * capabilities outright. A places-scoped operator can approve places and is
 * refused everywhere else.
 */
function moduleStaff(string $module, array $attributes = []): User
{
    return User::factory()->create($attributes + [
        'role' => 'user',
        'permissions' => PermissionCatalogue::forModule($module),
    ]);
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

/**
 * The JSON-RPC surface itself, for the two things a direct handle() call cannot
 * reach: what shouldRegister() offers an agent, and the catalogue two-hop
 * (search_tools, then execute_tools) the write tools live behind.
 */
function mcpCall(string $plainTextToken, array $payload)
{
    return test()
        ->withHeader('Authorization', 'Bearer '.$plainTextToken)
        ->postJson('/mcp/admin', array_merge(['jsonrpc' => '2.0', 'id' => 1], $payload));
}

/** @return Collection<int, string> */
function mcpToolNames(string $plainTextToken): Collection
{
    return collect(
        mcpCall($plainTextToken, ['method' => 'tools/list'])
            ->assertOk()
            ->json('result.tools')
    )->pluck('name');
}

/** @return array<int, string> */
function mcpSearchToolNames(string $plainTextToken, string $query): array
{
    $response = mcpCall($plainTextToken, [
        'method' => 'tools/call',
        'params' => [
            'name' => 'search_tools',
            'arguments' => ['query' => $query, 'limit' => 50],
        ],
    ])->assertOk();

    // search_tools replies with Response::text(), so the catalogue is JSON
    // inside a text block rather than in structuredContent.
    $text = $response->json('result.content.0.text') ?? '';
    $payload = json_decode($text, true);

    return collect($payload['tools'] ?? [])
        ->pluck('name')
        ->all();
}

/**
 * Run one catalogue write tool through execute_tools and return the decoded
 * payload it produced.
 *
 * execute_tools answers as an SSE stream (text/event-stream, one `data:` line
 * per message) rather than a JSON body, so the payload has to be pulled out of
 * the stream. This is the only write path an agent has, so it is worth
 * exercising for real rather than calling handle() directly.
 *
 * @param  array<string, mixed>  $arguments
 * @return array<string, mixed>
 */
function mcpExecuteTool(string $plainTextToken, string $toolName, array $arguments): array
{
    $response = mcpCall($plainTextToken, [
        'method' => 'tools/call',
        'params' => [
            'name' => 'execute_tools',
            'arguments' => [
                'calls' => [
                    ['name' => $toolName, 'arguments' => $arguments],
                ],
            ],
        ],
    ])->assertOk();

    $stream = (string) $response->streamedContent();

    // Keep the last data line: execute_tools emits a notification per tool
    // first, then the final envelope.
    $lines = array_values(array_filter(
        array_map('trim', explode("\n", $stream)),
        fn (string $line) => str_starts_with($line, 'data:'),
    ));

    $envelope = null;
    foreach ($lines as $line) {
        $decoded = json_decode(substr($line, strlen('data:')), true);

        if (is_array($decoded)) {
            $envelope = $decoded;
        }
    }

    // The stream carries the JSON-RPC envelope, whose result is itself a single
    // text block holding the catalogue's JSON.
    $text = $envelope['result']['content'][0]['text'] ?? null;
    $payload = is_string($text) ? json_decode($text, true) : null;

    return is_array($payload) ? $payload : ['raw' => $stream];
}

require_once __DIR__.'/Support/Fixtures.php';
