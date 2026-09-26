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

#[Name('reorder-syofficial-entities')]
#[Title('Reorder SyOfficial Entities')]
#[Description(
    'Set the display order of official entities. Ordering is per category, so send the entities of one '
    .'category rather than a mixed list — pass a category_id to reorder just that group. Use '
    .'order_column counting from 1.'
)]
#[IsDestructive]
#[IsIdempotent]
class ReorderSyOfficialEntitiesTool extends SyOfficialTool
{
    protected array $permissions = ['syofficial.reorder'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'orders' => $schema->array()
                ->description('The entities and the position each should take. All of these must belong to the same category.')
                ->items($schema->object([
                    'id' => $schema->string()->description('Entity id.'),
                    'order_column' => $schema->integer()->description('Display position within the category, counting from 1.'),
                ]))
                ->required(),

            'category_id' => $schema->string()
                ->description('Optional. Narrows the reorder to one category and fails if any id belongs elsewhere, which catches the common mistake of mixing categories.'),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'orders' => 'required|array',
            'orders.*.id' => 'required|string|max:128',
            'orders.*.order_column' => 'required|integer',
            'category_id' => 'sometimes|string|max:64',
        ]);

        $ids = array_column($validated['orders'], 'id');

        return $this->attempt(function () use ($validated, $ids) {
            $service = app(SyOfficialDirectoryService::class);
            $entities = $service->entities()->keyBy('id');

            $missing = array_values(array_diff($ids, $entities->keys()->all()));

            if ($missing !== []) {
                return Response::error(sprintf(
                    'No entity exists with id: %s. Call list-syofficial-entities for the valid ids.',
                    implode(', ', $missing)
                ));
            }

            if (isset($validated['category_id'])) {
                $foreign = array_values(array_filter(
                    $ids,
                    fn (string $id) => $entities[$id]->category_id !== $validated['category_id'],
                ));

                if ($foreign !== []) {
                    return Response::error(sprintf(
                        'These entities are not in category "%s": %s. Ordering is per category, so send one category at a time.',
                        $validated['category_id'],
                        implode(', ', $foreign)
                    ));
                }
            }

            $written = $service->reorderEntities($validated['orders']);

            return Response::structured([
                'reordered' => true,
                'entities_updated' => $written,
            ]);
        });
    }
}
