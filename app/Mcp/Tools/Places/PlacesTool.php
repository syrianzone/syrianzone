<?php

namespace App\Mcp\Tools\Places;

use App\Exceptions\Places\PlaceActionException;
use App\Mcp\Tools\AuditedTool;
use App\Models\Place;
use App\Services\Places\PlacePresenter;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

/**
 * Shared helpers for places tools.
 *
 * The domain throws PlaceActionException; a tool wants an agent-readable
 * sentence. This keeps that translation in one place instead of repeating the
 * same try/catch in six tool classes.
 */
abstract class PlacesTool extends AuditedTool
{
    /**
     * Run a domain call, converting a refusal into a response the agent can act
     * on rather than a generic failure.
     *
     * @param  callable(): (Response|ResponseFactory)  $callback
     */
    protected function attempt(callable $callback): Response|ResponseFactory
    {
        try {
            return $callback();
        } catch (PlaceActionException $e) {
            return Response::error(match ($e->kind) {
                PlaceActionException::NOT_PENDING => sprintf(
                    '%s Only a pending place can be moderated, so there is nothing to do. Re-read the place to confirm its current status before retrying.',
                    $e->getMessage()
                ),
                PlaceActionException::NOT_FOUND => sprintf(
                    '%s Check the id with list-places before retrying.',
                    $e->getMessage()
                ),
                PlaceActionException::LAST_PHOTO => sprintf(
                    '%s Add a replacement photo first, or leave the place as it is.',
                    $e->getMessage()
                ),
                PlaceActionException::PHOTO_FILE_MISSING => sprintf(
                    '%s Use replace-place-photo on this photo id to upload a new file.',
                    $e->getMessage()
                ),
                default => $e->getMessage(),
            });
        }
    }

    /**
     * @return array<string, mixed>
     */
    protected function placePayload(Place $place, ?int $viewerId = null): array
    {
        return app(PlacePresenter::class)->item(
            app(PlacePresenter::class)->present($place, $viewerId)
        );
    }
}
