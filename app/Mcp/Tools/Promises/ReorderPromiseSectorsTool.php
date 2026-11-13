<?php

namespace App\Mcp\Tools\Promises;

use App\Services\Promises\PromiseSectorService;
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
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('reorder-promise-sectors')]
#[Title('Reorder Promise Sectors')]
#[Description(
    'Set the display order of the sectors. Pass every sector id exactly once, in the order you want; '
    .'list-promise-sectors gives the current order.'
)]
#[IsDestructive]
#[IsIdempotent]
class ReorderPromiseSectorsTool extends PromisesTool
{
    protected array $permissions = [PermissionCatalogue::PROMISES_SPEAKERS];

    public function schema(JsonSchema $schema): array
    {
        return [
            'ids' => $schema->array()
                ->description('Every sector id, in display order.')
                ->items($schema->string())
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['string'],
        ]);
        $ids = $validated['ids'];

        return $this->attempt(function () use ($ids) {
            $service = app(PromiseSectorService::class);
            $known = $service->ids();

            // Checked here, not left to the dashboard's rule, so the agent is
            // told which ids to fix. A partial list would leave the sectors it
            // skips colliding with the positions it assigns, so the order must
            // name every sector exactly once.
            $problems = array_filter([
                'Unknown' => array_values(array_diff($ids, $known)),
                'Repeated' => array_values(array_unique(array_diff_assoc($ids, array_unique($ids)))),
                'Missing' => array_values(array_diff($known, $ids)),
            ]);

            if ($problems !== []) {
                return Response::error(sprintf(
                    'Pass every sector id exactly once. %s. Call list-promise-sectors for the full list.',
                    implode('. ', array_map(
                        fn (string $label, array $list) => $label.': '.implode(', ', $list),
                        array_keys($problems),
                        $problems,
                    )),
                ));
            }

            $service->reorder($ids);

            return Response::structured([
                'reordered' => true,
                'ids' => $ids,
            ]);
        });
    }
}
