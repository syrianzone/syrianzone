<?php

namespace App\Mcp\Tools\SyOfficial;

use App\Services\SyOfficial\SyOfficialDirectoryService;
use App\Services\SyOfficial\SyOfficialPresenter;
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
 * Like ListSyOfficialCategoriesTool, reading needs no dedicated capability, so
 * any of the five grants is enough. See that class for why.
 */
#[Name('list-syofficial-entities')]
#[Title('List SyOfficial Entities')]
#[Description(
    'List the official entities in the SyOfficial directory — ministries, governorates and similar — '
    .'in display order, with their category, labels, social links and active flag. Filter by category '
    .'to get one group at a time. Entities are the directory entries users actually see.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListSyOfficialEntitiesTool extends SyOfficialTool
{
    protected array $anyPermissions = [
        'syofficial.create',
        'syofficial.edit',
        'syofficial.toggle',
        'syofficial.delete',
        'syofficial.reorder',
    ];

    public function schema(JsonSchema $schema): array
    {
        return [
            'category_id' => $schema->string()
                ->description('Restrict to one category. Omit for every category. Get valid ids from list-syofficial-categories.'),
            'only_active' => $schema->boolean()
                ->description('When true, return only entries visible on the public site.')
                ->default(false),
        ];
    }

    public function outputSchema(JsonSchema $schema): array
    {
        return [
            'count' => $schema->integer(),
            'entities' => $schema->array()
                ->items($schema->object([
                    'id' => $schema->string(),
                    'category_id' => $schema->string(),
                    'category_label_ar' => $schema->string()->nullable(),
                    'category_label_en' => $schema->string()->nullable(),
                    'name' => $schema->string(),
                    'name_ar' => $schema->string(),
                    'description' => $schema->string()->nullable(),
                    'description_ar' => $schema->string()->nullable(),
                    'image' => $schema->string()->nullable(),
                    'socials' => $schema->array()->items($schema->string()),
                    'order_column' => $schema->integer(),
                    'is_active' => $schema->boolean(),
                ])),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'category_id' => 'sometimes|string|max:64',
            'only_active' => 'sometimes|boolean',
        ]);

        $service = app(SyOfficialDirectoryService::class);

        $entities = $service->entities()
            ->when(
                isset($validated['category_id']),
                fn ($q) => $q->where('category_id', $validated['category_id'])
            )
            ->when(
                ($validated['only_active'] ?? false) === true,
                fn ($q) => $q->where('is_active', true)
            )
            ->values();

        return Response::structured([
            'count' => $entities->count(),
            'entities' => app(SyOfficialPresenter::class)->entities($entities),
        ]);
    }
}
