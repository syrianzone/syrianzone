<?php

namespace App\Mcp\Tools\Transit;

use App\Exceptions\Transit\TransitActionException;
use App\Mcp\Tools\AuditedTool;
use App\Support\Agents\AgentContext;
use Illuminate\Auth\Access\AuthorizationException;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

/**
 * Shared helpers for transit tools.
 *
 * Transit is the only governorate-scoped module, and the scope cannot always be
 * read off the tool arguments: approving draft 91 acts on whatever governorate
 * that draft belongs to, which is a database fact, not an input. So these tools
 * resolve their target first and then call guardCity() with the city it actually
 * turned out to be in. Checking before resolution would either be impossible or
 * would trust the caller's claim.
 */
abstract class TransitTool extends AuditedTool
{
    protected function isCityScoped(): bool
    {
        return true;
    }

    /**
     * Assert the agent may exercise $permission in $cityId.
     *
     * The denial deliberately does not say whether the governorate exists, only
     * that the agent may not work there, so a scoped token cannot enumerate
     * governorates by watching which ids 403.
     *
     * @throws AuthorizationException
     */
    protected function guardCity(AgentContext $context, string $permission, ?string $cityId): void
    {
        if (! $context->canInCity($permission, $cityId)) {
            throw new AuthorizationException(sprintf(
                'Permission denied: this agent may not use the %s capability in governorate "%s". '
                .'Ask an administrator to add that governorate to the agent\'s transit scope.',
                $permission,
                $cityId ?? 'unknown'
            ));
        }
    }

    /**
     * @param  callable(): (Response|ResponseFactory)  $callback
     */
    protected function attempt(callable $callback): Response|ResponseFactory
    {
        try {
            return $callback();
        } catch (TransitActionException $e) {
            return Response::error(match ($e->kind) {
                TransitActionException::DRAFT_NOT_PENDING => sprintf(
                    '%s Re-read the draft to confirm its current status, then decide whether it still needs action.',
                    $e->getMessage()
                ),
                TransitActionException::STATUS_UNCHANGED => sprintf(
                    '%s Nothing to do.',
                    $e->getMessage()
                ),
                TransitActionException::SAME_CITY => sprintf(
                    '%s Pass the governorate it should move to.',
                    $e->getMessage()
                ),
                TransitActionException::NO_CHANGES => sprintf(
                    '%s',
                    $e->getMessage()
                ),
                default => $e->getMessage(),
            });
        }
    }
}
