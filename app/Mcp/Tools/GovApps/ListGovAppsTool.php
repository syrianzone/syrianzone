<?php

namespace App\Mcp\Tools\GovApps;

use App\Services\GovApps\GovAppPresenter;
use App\Services\GovApps\GovAppService;
use App\Support\Agents\AgentContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

/**
 * Reading needs no dedicated capability, so any of the five grants is enough.
 * See ListSyOfficialCategoriesTool for why an any-of gate is the right reading
 * of the current catalogue.
 */
#[Name('list-gov-apps')]
#[Title('List Government Apps')]
#[Description(
    'List the government applications directory in display order, with names, descriptions, icons, links '
    .'and active flags. Soft-deleted apps are not included; to find one that was deleted, use '
    .'restore-gov-app with the id. The entry point for the module.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListGovAppsTool extends GovAppsTool
{
    protected array $anyPermissions = [
        'govapps.create',
        'govapps.edit',
        'govapps.toggle',
        'govapps.delete',
        'govapps.reorder',
    ];

    public function schema(JsonSchema $schema): array
    {
        return [
            'only_active' => $schema->boolean()
                ->description('When true, return only the apps visible on the public site.')
                ->default(false),
        ];
    }

    public function outputSchema(JsonSchema $schema): array
    {
        return [
            'count' => $schema->integer(),
            'apps' => $schema->array()
                ->items($schema->object([
                    'id' => $schema->string(),
                    'name' => $schema->string(),
                    'name_ar' => $schema->string()->nullable(),
                    'description' => $schema->string()->nullable(),
                    'description_ar' => $schema->string()->nullable(),
                    'icon' => $schema->string()->nullable(),
                    'images' => $schema->array()->items($schema->string()),
                    'links' => $schema->array()->items($schema->string()),
                    'order_column' => $schema->integer(),
                    'is_active' => $schema->boolean(),
                ])),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'only_active' => 'sometimes|boolean',
        ]);

        $apps = app(GovAppService::class)->apps()
            ->when(
                ($validated['only_active'] ?? false) === true,
                fn ($q) => $q->where('is_active', true)
            )
            ->values();

        return Response::structured([
            'count' => $apps->count(),
            'apps' => app(GovAppPresenter::class)->items($apps),
        ]);
    }
}
