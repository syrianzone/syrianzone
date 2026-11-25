<?php

namespace App\Mcp\Tools\GovApps;

use App\Exceptions\Directories\DirectoryActionException;
use App\Mcp\Tools\AuditedTool;
use Illuminate\Contracts\JsonSchema\JsonSchema;
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
     * JSON Schema properties for the `gov_apps.links` object map.
     *
     * @return array<string, mixed>
     */
    protected function linkProperties(JsonSchema $schema): array
    {
        return [
            'official' => $schema->string()->description('Official website URL (http or https).')->nullable(),
            'android' => $schema->string()->description('Google Play Store or APK download URL (http or https).')->nullable(),
            'apple' => $schema->string()->description('Apple App Store URL (http or https).')->nullable(),
        ];
    }

    /**
     * Shared JSON Schema fields for the rich Arabic guide on `/govapps/{id}`.
     *
     * @return array<string, mixed>
     */
    protected function guideProperties(JsonSchema $schema): array
    {
        return [
            'official_entity_id' => $schema->string()
                ->description('Optional SyOfficial entity id for the issuing ministry/agency (e.g. "min-interior"). Pass null to clear.')
                ->nullable(),
            'overview_ar' => $schema->string()
                ->description('Rich Arabic overview (1-2 paragraphs separated by blank lines) explaining what the app does and who it serves.')
                ->nullable(),
            'features' => $schema->array()
                ->description('List of concrete Arabic service/feature bullets (3-8 items).')
                ->items($schema->string()->max(500)),
            'requirements' => $schema->array()
                ->description('List of Arabic getting-started requirements or installation steps.')
                ->items($schema->string()->max(500)),
            'faqs' => $schema->array()
                ->description('List of app-specific Arabic Q&A items: [{"q": "...", "a": "..."}].')
                ->items($schema->object([
                    'q' => $schema->string()->required(),
                    'a' => $schema->string()->required(),
                ])),
            'verified_at' => $schema->string()
                ->description('Date official links were last verified (YYYY-MM-DD).')
                ->nullable(),
        ];
    }

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
