<?php

namespace App\Support\Agents;

use App\Models\McpToolCall;
use Illuminate\Http\Request as HttpRequest;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;

/**
 * Writes the append-only agent trail.
 *
 * Failures here are swallowed and logged, never thrown: losing an audit row
 * must not turn a successful moderation action into a 500 for the agent, but it
 * must be visible. Audit writes are skipped entirely when the connection is
 * read-only (a replica) rather than breaking the tool call.
 */
final class AgentAudit
{
    public const OUTCOME_OK = 'ok';

    public const OUTCOME_DENIED = 'denied';

    public const OUTCOME_INVALID = 'invalid';

    public const OUTCOME_ERROR = 'error';

    public function record(
        AgentContext $context,
        HttpRequest $http,
        string $tool,
        string $outcome,
        ?string $error = null,
        ?int $durationMs = null,
        array $arguments = [],
    ): void {
        if (! config('mcp.audit.enabled', true)) {
            return;
        }

        try {
            McpToolCall::create([
                'user_id' => $context->id(),
                'token_id' => $context->tokenId(),
                'token_name' => $context->tokenName(),
                'tool' => $tool,
                'arguments' => $this->redact($arguments),
                'outcome' => $outcome,
                'error' => $error === null ? null : mb_substr($error, 0, 2000),
                'duration_ms' => $durationMs,
                'ip' => $http->ip(),
                'user_agent' => mb_substr((string) $http->userAgent(), 0, 255) ?: null,
            ]);
        } catch (\Throwable $e) {
            Log::warning('mcp.audit.write_failed', [
                'tool' => $tool,
                'outcome' => $outcome,
                'exception' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Strip anything that looks like a credential from the stored arguments.
     *
     * Arguments are agent-authored and land in the database verbatim otherwise,
     * so a tool call that quotes a freshly minted token — or a pasted password —
     * would persist it in plaintext. Matching is case-insensitive and recursive,
     * so nested payloads are covered too.
     */
    public function redact(array $arguments): array
    {
        $keys = array_map('mb_strtolower', (array) config('mcp.audit.redact', []));

        $walk = function (array $carry) use (&$walk, $keys): array {
            foreach ($carry as $key => $value) {
                if (is_string($key) && in_array(mb_strtolower($key), $keys, true)) {
                    $carry[$key] = '[redacted]';

                    continue;
                }

                $carry[$key] = is_array($value) ? $walk($value) : $value;
            }

            return $carry;
        };

        return $walk(Arr::from($arguments));
    }
}
