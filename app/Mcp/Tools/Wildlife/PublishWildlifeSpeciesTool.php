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

#[Name('publish-wildlife-species')]
#[Title('Publish Wildlife Species')]
#[Description(
    'Make a species\' draft public on /wild/{slug}, or show a hidden species again. This is the review step: '
    .'before publishing, check each statement of the draft against the source it cites, the IUCN link, and the '
    .'photo credits. The guide\'s rule is that a second person reviews each new or changed record, so do not '
    .'publish a draft you wrote yourself.'
)]
#[IsDestructive]
class PublishWildlifeSpeciesTool extends WildlifeTool
{
    protected array $permissions = [PermissionCatalogue::WILDLIFE_PUBLISH];

    public function schema(JsonSchema $schema): array
    {
        return [
            'slug' => $this->slugSchema($schema),
            'expected_version' => $this->versionSchema($schema),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'slug' => 'required|string|max:80',
            'expected_version' => 'required|integer|min:1',
        ]);

        return $this->attempt(function () use ($validated, $context) {
            $editor = $this->findSpecies($validated['slug'])->draft_updated_by;
            $species = app(WildlifeEditor::class)->publish($validated['slug'], (int) $validated['expected_version'], $context->user);

            return Response::structured([
                'published' => true,
                'url' => url('/wild/'.$species->slug),
                // The guide asks for a second reviewer; say so when it was not one.
                'reviewed_by_draft_author' => $editor !== null && $editor === $context->user?->id,
                'species' => $this->detail($species),
            ]);
        });
    }
}
