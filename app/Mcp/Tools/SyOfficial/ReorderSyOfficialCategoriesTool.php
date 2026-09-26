<?php

namespace App\Mcp\Tools\SyOfficial;

use App\Services\SyOfficial\SyOfficialDirectoryService;
use App\Support\Agents\AgentContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('reorder-syofficial-categories')]
#[Title('Reorder SyOfficial Categories')]
#[Description(
    'Set the display order of the SyOfficial categories. Pass the complete list you want, in the order you '
    .'want it, with order_column counting from 1 — the response of list-syofficial-categories is the '
    .'natural starting point. Ids not mentioned keep their current position relative to what you do pass.'
)]
#[IsDestructive]
#[IsIdempotent]
class ReorderSyOfficialCategoriesTool extends SyOfficialTool
{
    protected array $permissions = ['syofficial.reorder'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'orders' => $schema->array()
                ->description('The categories and the position each should take. Send every category for a predictable result.')
                ->items($schema->object([
                    'id' => $schema->string()->description('Category id.'),
                    'order_column' => $schema->integer()->description('Display position, counting from 1.'),
                ]))
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'orders' => 'required|array',
            'orders.*.id' => 'required|string|max:64',
            'orders.*.order_column' => 'required|integer',
        ]);

        $ids = array_column($validated['orders'], 'id');

        return $this->attempt(function () use ($validated, $ids) {
            $service = app(SyOfficialDirectoryService::class);

            // The existence check lives here rather than in the service so a bad
            // id is a validation error the agent can fix, not a silent no-op
            // update that reports success.
            $missing = array_values(array_diff(
                $ids,
                $service->categories()->pluck('id')->all(),
            ));

            if ($missing !== []) {
                return Response::error(sprintf(
                    'No category exists with id: %s. Call list-syofficial-categories for the valid ids.',
                    implode(', ', $missing)
                ));
            }

            $written = $service->reorderCategories($validated['orders']);

            return Response::structured([
                'reordered' => true,
                'categories_updated' => $written,
            ]);
        });
    }
}
