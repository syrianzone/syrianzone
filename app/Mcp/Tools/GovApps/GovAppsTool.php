<?php

namespace App\Mcp\Tools\GovApps;

use App\Exceptions\Directories\DirectoryActionException;
use App\Mcp\Tools\AuditedTool;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

/**
 * Shared helpers for government apps tools.
 *
 * Same shape as SyOfficialTool; kept separate rather than merged so each
 * module's guidance can diverge without the other inheriting a wrong hint.
 */
abstract class GovAppsTool extends AuditedTool
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
                    '%s Call list-gov-apps to see the valid ids.',
                    $e->getMessage()
                ),
                DirectoryActionException::ID_TAKEN => sprintf(
                    '%s Note that a deleted app keeps its id, so this one may be recoverable with restore-gov-app rather than reusable.',
                    $e->getMessage()
                ),
                DirectoryActionException::ID_REQUIRED => sprintf(
                    '%s Ids are lowercase words and dashes only, for example "services".',
                    $e->getMessage()
                ),
                default => $e->getMessage(),
            });
        }
    }
}
