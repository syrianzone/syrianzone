<?php

namespace App\Mcp\Resources;

use App\Models\McpToolCall;
use App\Support\Agents\AgentContext;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Attributes\Uri;
use Laravel\Mcp\Server\Resource;

/**
 * This token's own audit trail.
 *
 * Scoped to the calling token on purpose. An agent asking "what have I already
 * done" should see its own history — useful for resuming an interrupted sweep,
 * and a check that a delete or approve did what it claimed. It is deliberately
 * not a window onto other tokens or other users.
 */
#[Name('agent-token-audit')]
#[Uri('syrianzone://agent/audit-trail')]
#[Title('Agent Token Audit Trail')]
#[Description(
    'Recent tool calls made with this token: tool name, outcome, when, and how long it took. '
    .'Use it to confirm a previous action landed, or to pick up an interrupted moderation sweep where it left off.'
)]
class AgentTokenResource extends Resource
{
    public function handle(Request $request): Response
    {
        $context = app(AgentContext::class);
        $tokenId = $context->tokenId();

        if ($tokenId === null) {
            return Response::text('No API token is associated with this session, so there is no audit history to show.');
        }

        $limit = min(200, max(1, (int) ($request->get('limit') ?? 50)));

        $calls = McpToolCall::query()
            ->where('token_id', $tokenId)
            ->latest('id')
            ->limit($limit)
            ->get(['tool', 'outcome', 'error', 'duration_ms', 'created_at', 'arguments']);

        $payload = [
            'token' => $context->tokenName(),
            'total_shown' => $calls->count(),
            'calls' => $calls->map(fn (McpToolCall $call) => [
                'tool' => $call->tool,
                'outcome' => $call->outcome,
                'at' => $call->created_at?->toIso8601String(),
                'duration_ms' => $call->duration_ms,
                'error' => $call->error,
                'arguments' => $call->arguments,
            ])->all(),
        ];

        return Response::text((string) json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
}
