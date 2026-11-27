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
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('move-wildlife-species')]
#[Title('Move Wildlife Species')]
#[Description(
    'Change where a species sits in the guide\'s order: right after another species, or first. The order '
    .'decides the hub grid and which species a page links to as related.'
)]
#[IsIdempotent]
class MoveWildlifeSpeciesTool extends WildlifeTool
{
    protected array $permissions = [PermissionCatalogue::WILDLIFE_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'slug' => $this->slugSchema($schema),
            'expected_version' => $this->versionSchema($schema),
            'after_slug' => $schema->string()->description('Put it right after this species. Omit (or null) to put it first.')->nullable(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'slug' => 'required|string|max:80',
            'expected_version' => 'required|integer|min:1',
            'after_slug' => 'sometimes|nullable|string|max:80|different:slug',
        ]);

        return $this->attempt(function () use ($validated) {
            $species = app(WildlifeEditor::class)->move($validated['slug'], $validated['after_slug'] ?? null, (int) $validated['expected_version']);

            return Response::structured(['moved' => true, 'species' => $this->summary($species)]);
        });
    }
}
