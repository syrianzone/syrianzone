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

#[Name('create-wildlife-species')]
#[Title('Create Wildlife Species')]
#[Description(
    'Add a species to the wildlife guide as a draft. It is not on the public site until someone with '
    .'wildlife.publish reviews it against its sources and calls publish-wildlife-species. The record must pass '
    .'the sourcing rules (see get-wildlife-options); every broken rule is listed in the refusal.'
)]
class CreateWildlifeSpeciesTool extends WildlifeTool
{
    protected array $permissions = [PermissionCatalogue::WILDLIFE_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'record' => $this->recordSchema($schema)->required(),
            'after_slug' => $schema->string()->description('Place it right after this species in the guide (next to related ones). Omit to add it at the end.'),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'record' => 'required|array',
            'after_slug' => 'sometimes|nullable|string|max:80',
        ]);

        return $this->attempt(function () use ($validated, $context) {
            $species = app(WildlifeEditor::class)->create($validated['record'], $context->user, $validated['after_slug'] ?? null);

            return Response::structured(['created' => true, 'species' => $this->detail($species)]);
        });
    }
}
