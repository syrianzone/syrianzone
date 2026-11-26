<?php

namespace App\Mcp\Tools\Places;

use App\Services\Places\PlaceMergeService;
use App\Services\Places\PlaceModerationService;
use App\Support\Agents\AgentContext;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('merge-places')]
#[Title('Merge Duplicate Places')]
#[Description(
    'Merge an approved duplicate Mishwar place (source_id) into another approved place (target_id). '
    .'Defaults to dry_run=true so you can inspect the exact changes first; pass dry_run=false to apply. '
    .'Appends source photos to the target up to the '.PlaceModerationService::MAX_PHOTOS_PER_PLACE.'-photo limit '
    .'(overflow photos remain on the source and are reported), moves saves without duplicating per-user saves '
    .'and recomputes saves_count, moves open reports to the target (resolving any duplicate-reporter conflicts on '
    .'the source), optionally adopts the source description via keep_description, and marks the source merged so '
    .'its old URLs 301-redirect to the target (following merge chains) while disappearing from maps, hubs and sitemaps. '
    .'Requires both places.edit and places.delete.'
)]
#[IsDestructive]
class MergePlacesTool extends PlacesTool
{
    protected array $permissions = [
        PermissionCatalogue::PLACES_EDIT,
        PermissionCatalogue::PLACES_DELETE,
    ];

    public function schema(JsonSchema $schema): array
    {
        return [
            'source_id' => $schema->integer()
                ->description('Id of the approved duplicate place to retire and merge into target_id.')
                ->min(1)
                ->required(),

            'target_id' => $schema->integer()
                ->description('Id of the approved canonical place to keep.')
                ->min(1)
                ->required(),

            'dry_run' => $schema->boolean()
                ->description('Preview the exact changes without modifying the database. Defaults to true; pass false to apply.')
                ->default(true),

            'keep_description' => $schema->string()
                ->enum(PlaceMergeService::KEEP_DESCRIPTION_OPTIONS)
                ->description('Which description to keep on the target: "target" (default), "source", or "longer".')
                ->default(PlaceMergeService::KEEP_TARGET),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'source_id' => ['required', 'integer', 'min:1'],
            'target_id' => ['required', 'integer', 'min:1'],
            'dry_run' => ['sometimes', 'boolean'],
            'keep_description' => ['sometimes', 'string', Rule::in(PlaceMergeService::KEEP_DESCRIPTION_OPTIONS)],
        ]);

        return $this->attempt(function () use ($validated) {
            $result = app(PlaceMergeService::class)->merge(
                sourceId: (int) $validated['source_id'],
                targetId: (int) $validated['target_id'],
                keepDescription: (string) ($validated['keep_description'] ?? PlaceMergeService::KEEP_TARGET),
                dryRun: (bool) ($validated['dry_run'] ?? true),
            );

            return Response::structured($result);
        });
    }
}
