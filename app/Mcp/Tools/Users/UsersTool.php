<?php

namespace App\Mcp\Tools\Users;

use App\Exceptions\Users\UserModerationException;
use App\Mcp\Tools\AuditedTool;
use App\Models\User;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

/**
 * Shared helpers for user moderation tools.
 *
 * The refusals here are load-bearing rather than advisory: a ban takes effect on
 * the target's very next request, so a mistake is not something the agent can
 * inspect its way out of.
 */
abstract class UsersTool extends AuditedTool
{
    /**
     * Run a domain call, turning a refusal into something the agent can act on.
     *
     * @param  callable(): (Response|ResponseFactory)  $callback
     */
    protected function attempt(callable $callback): Response|ResponseFactory
    {
        try {
            return $callback();
        } catch (UserModerationException $e) {
            return Response::error(match ($e->kind) {
                UserModerationException::SELF_BAN => sprintf(
                    '%s This tool acts as the token owner, so there is no one left to undo it.',
                    $e->getMessage()
                ),
                UserModerationException::TARGET_IS_SUPERADMIN => sprintf(
                    '%s%s No amount of retrying will change that.',
                    $e->getMessage(),
                    isset($e->context['name'])
                        ? sprintf(' The target is "%s".', $e->context['name'])
                        : ''
                ),
                default => $e->getMessage(),
            });
        }
    }

    /**
     * The safe subset of a user, built field by field.
     *
     * Deliberately not User::toArray(). The model hides the password hash, but
     * still carries `permissions`, `permission_scopes`, `settings` and
     * `google_id`, and a moderation tool has no business handing an agent
     * somebody else's authorisation configuration. Naming the fields the caller
     * needs also keeps the response stable if the users table grows.
     *
     * @return array<string, mixed>
     */
    protected function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'is_banned' => (bool) $user->is_banned,
            'role' => $user->role,
        ];
    }
}
