<?php

namespace App\Mcp\Tools\Compass;

use App\Mcp\Tools\AuditedTool;
use App\Models\CompassFigure;
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
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list-compass-figures')]
#[Title('List Compass Figures')]
#[Description(
    'List political compass reference figures in display order, including category, alignment, '
    .'axis positions, and enabled status.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListCompassFiguresTool extends AuditedTool
{
    protected array $permissions = [PermissionCatalogue::COMPASS_FIGURES];

    public function schema(JsonSchema $schema): array
    {
        return [
            'category' => $schema->string()
                ->enum(CompassFigure::CATEGORIES)
                ->description('Optional category filter.'),

            'only_enabled' => $schema->boolean()
                ->description('When true, return only figures enabled on the public compass.')
                ->default(false),
        ];
    }

    public function outputSchema(JsonSchema $schema): array
    {
        return [
            'count' => $schema->integer(),
            'figures' => $schema->array()
                ->items($schema->object([
                    'id' => $schema->integer(),
                    'name' => $schema->string(),
                    'category' => $schema->string(),
                    'align' => $schema->string(),
                    'enabled' => $schema->boolean(),
                    'sortOrder' => $schema->integer(),
                ])),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'category' => ['sometimes', Rule::in(CompassFigure::CATEGORIES)],
            'only_enabled' => 'sometimes|boolean',
        ]);

        $figures = CompassFigure::query()
            ->when(isset($validated['category']), fn ($q) => $q->where('category', $validated['category']))
            ->when(($validated['only_enabled'] ?? false) === true, fn ($q) => $q->where('enabled', true))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return Response::structured([
            'count' => $figures->count(),
            'figures' => $figures->map(fn (CompassFigure $f) => $f->toAdminPayload())->all(),
        ]);
    }
}
