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
 * Reading the directory needs no dedicated capability, so this tool accepts any
 * of the five. Requiring a *write* grant in order to look would be wrong, and
 * inventing a sixth read-only capability would silently change what existing
 * tokens and roles resolve to, so any-of is the honest reading of the current
 * catalogue.
 */
#[Name('list-syofficial-categories')]
#[Title('List SyOfficial Categories')]
#[Description(
    'List the SyOfficial directory categories in display order, with their labels and whether each is '
    .'active. This is the entry point for the module: every other SyOfficial tool needs a category id, '
    .'and this is where they come from.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListSyOfficialCategoriesTool extends SyOfficialTool
{
    protected array $anyPermissions = [
        'syofficial.create',
        'syofficial.edit',
        'syofficial.toggle',
        'syofficial.delete',
        'syofficial.reorder',
    ];

    public function outputSchema(JsonSchema $schema): array
    {
        return [
            'count' => $schema->integer()->description('How many categories were returned.'),
            'categories' => $schema->array()
                ->items($schema->object([
                    'id' => $schema->string()->description('Stable slug, used as the category_id everywhere else.'),
                    'label_ar' => $schema->string(),
                    'label_en' => $schema->string(),
                    'icon' => $schema->string()->nullable(),
                    'order_column' => $schema->integer()->description('Display position; lower comes first.'),
                    'is_active' => $schema->boolean()->description('Inactive categories are hidden from the public site but keep their data.'),
                ])),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $categories = app(SyOfficialDirectoryService::class)->categories();

        return Response::structured([
            'count' => $categories->count(),
            'categories' => app(SyOfficialPresenter::class)->categories($categories),
        ]);
    }
}
