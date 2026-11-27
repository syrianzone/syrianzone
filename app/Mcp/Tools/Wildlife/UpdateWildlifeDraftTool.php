<?php

namespace App\Mcp\Tools\Wildlife;

use App\Services\Wildlife\WildlifeEditor;
use App\Support\Agents\AgentContext;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('update-wildlife-draft')]
#[Title('Update Wildlife Draft')]
#[Description(
    'Write a new draft of a species: a full replacement of the record, so call get-wildlife-species first and '
    .'start from its draft (or, when there is none, its published record), resending every field. The public page '
    .'keeps showing the published record until publish-wildlife-species. Set lastReviewed to the day you checked '
    .'the record against its sources. The slug cannot change.'
)]
#[IsDestructive]
#[IsIdempotent]
class UpdateWildlifeDraftTool extends WildlifeTool
{
    protected array $permissions = [PermissionCatalogue::WILDLIFE_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'slug' => $this->slugSchema($schema),
            'expected_version' => $this->versionSchema($schema),
            'record' => $this->recordSchema($schema)->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'slug' => 'required|string|max:80',
            'expected_version' => 'required|integer|min:1',
            'record' => 'required|array',
        ]);

        return $this->attempt(function () use ($validated, $context) {
            $species = app(WildlifeEditor::class)->saveDraft(
                $validated['slug'], $validated['record'], (int) $validated['expected_version'], $context->user,
            );

            return Response::structured(['saved' => true, 'species' => $this->detail($species)]);
        });
    }
}
