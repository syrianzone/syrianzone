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

#[Name('unpublish-wildlife-species')]
#[Title('Unpublish Wildlife Species')]
#[Description(
    'Take a species off the public site (its page answers 404 and it leaves the hub, the sitemap and the '
    .'governorate pages) while keeping its record and any draft. publish-wildlife-species shows it again.'
)]
#[IsDestructive]
class UnpublishWildlifeSpeciesTool extends WildlifeTool
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

        return $this->attempt(function () use ($validated) {
            $species = app(WildlifeEditor::class)->unpublish($validated['slug'], (int) $validated['expected_version']);

            return Response::structured(['unpublished' => true, 'species' => $this->detail($species)]);
        });
    }
}
