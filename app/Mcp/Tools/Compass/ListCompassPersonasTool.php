<?php

namespace App\Mcp\Tools\Compass;

use App\Mcp\Tools\AuditedTool;
use App\Models\CompassPersona;
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
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list-compass-personas')]
#[Title('List Compass Personas')]
#[Description(
    'List political compass personas (spectrums) in display order, with slug, icon, summary, '
    .'center vector, axis ranges, and enabled status.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListCompassPersonasTool extends AuditedTool
{
    protected array $permissions = [PermissionCatalogue::COMPASS_PERSONAS];

    public function schema(JsonSchema $schema): array
    {
        return [
            'only_enabled' => $schema->boolean()
                ->description('When true, return only personas enabled on the public compass.')
                ->default(false),
        ];
    }

    public function outputSchema(JsonSchema $schema): array
    {
        return [
            'count' => $schema->integer(),
            'personas' => $schema->array()
                ->items($schema->object([
                    'id' => $schema->integer(),
                    'slug' => $schema->string(),
                    'name' => $schema->string(),
                    'enabled' => $schema->boolean(),
                    'sortOrder' => $schema->integer(),
                ])),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'only_enabled' => 'sometimes|boolean',
        ]);

        $personas = CompassPersona::query()
            ->when(($validated['only_enabled'] ?? false) === true, fn ($q) => $q->where('enabled', true))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return Response::structured([
            'count' => $personas->count(),
            'personas' => $personas->map(fn (CompassPersona $p) => $p->toAdminPayload())->all(),
        ]);
    }
}
