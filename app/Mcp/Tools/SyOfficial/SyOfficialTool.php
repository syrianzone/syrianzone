<?php

namespace App\Mcp\Tools\SyOfficial;

use App\Exceptions\Directories\DirectoryActionException;
use App\Mcp\Tools\AuditedTool;
use App\Support\Facts;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\JsonSchema\Types\Type;
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
     * The `socials` argument as an object keyed by platform.
     *
     * `official_entities.socials` is `{"facebook": "https://…"}` and the public
     * tile resolves its icon and label from the key, so the schema advertises
     * the vocabulary instead of an untyped list — an agent that sends a list is
     * refused. The keys come from `resources/data/social-platforms.json`.
     *
     * @return array<string, Type>
     */
    protected function socialProperties(JsonSchema $schema): array
    {
        $properties = [];

        foreach (Facts::socialPlatforms() as $platform) {
            $properties[$platform['key']] = $schema
                ->string()
                ->max(2048)
                ->description("{$platform['label_en']} profile URL.");
        }

        return $properties;
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
                DirectoryActionException::SOCIALS_NOT_KEYED => sprintf(
                    '%s Send an object whose keys are the platform names in the schema — one entry per platform, not one link per array slot.',
                    $e->getMessage()
                ),
                default => $e->getMessage(),
            });
        }
    }
}
