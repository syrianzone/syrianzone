<?php

namespace App\Mcp\Tools\SyOfficial;

use App\Exceptions\Directories\DirectoryActionException;
use App\Mcp\Tools\AuditedTool;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

/**
 * Shared helpers for SyOfficial tools.
 *
 * Turns a DirectoryActionException into something the agent can act on. The
 * "list first" hints matter: these ids are caller-supplied slugs, so an agent
 * that guesses one gets a clean refusal instead of a corrupted row.
 */
abstract class SyOfficialTool extends AuditedTool
{
    /**
     * @param  callable(): (Response|ResponseFactory)  $callback
     */
    protected function attempt(callable $callback): Response|ResponseFactory
    {
        try {
            return $callback();
        } catch (DirectoryActionException $e) {
            return Response::error(match ($e->kind) {
                DirectoryActionException::NOT_FOUND => sprintf(
                    '%s Call list-syofficial-categories or list-syofficial-entities to see the valid ids.',
                    $e->getMessage()
                ),
                DirectoryActionException::CATEGORY_NOT_FOUND => sprintf(
                    '%s Call list-syofficial-categories to see the valid category ids.',
                    $e->getMessage()
                ),
                DirectoryActionException::ID_TAKEN => sprintf(
                    '%s Ids are permanent, so pick a new one. Call the matching list tool to see what is taken.',
                    $e->getMessage()
                ),
                DirectoryActionException::ID_REQUIRED => sprintf(
                    '%s Ids are lowercase words and dashes only, for example "ministries".',
                    $e->getMessage()
                ),
                default => $e->getMessage(),
            });
        }
    }
}
