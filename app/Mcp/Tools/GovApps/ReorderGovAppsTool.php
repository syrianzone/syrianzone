<?php

namespace App\Mcp\Tools\GovApps;

use App\Services\GovApps\GovAppService;
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

#[Name('reorder-gov-apps')]
#[Title('Reorder Government Apps')]
#[Description(
    'Set the display order of the government applications. Pass the complete list you want, in the order '
    .'you want it, with order_column counting from 1 — the response of list-gov-apps is the natural '
    .'starting point.'
)]
#[IsDestructive]
#[IsIdempotent]
class ReorderGovAppsTool extends GovAppsTool
{
    protected array $permissions = ['govapps.reorder'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'orders' => $schema->array()
                ->description('The apps and the position each should take. Send every app for a predictable result.')
                ->items($schema->object([
                    'id' => $schema->string()->description('App id.'),
                    'order_column' => $schema->integer()->description('Display position, counting from 1.'),
                ]))
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'orders' => 'required|array',
            'orders.*.id' => 'required|string|max:128',
            'orders.*.order_column' => 'required|integer',
        ]);

        $ids = array_column($validated['orders'], 'id');

        return $this->attempt(function () use ($validated, $ids) {
            $service = app(GovAppService::class);

            // Checked here rather than in the service so a bad id is a
            // correctable validation error, not a silent no-op that reports
            // success.
            $missing = array_values(array_diff(
                $ids,
                $service->apps()->pluck('id')->all(),
            ));

            if ($missing !== []) {
                return Response::error(sprintf(
                    'No app exists with id: %s. Call list-gov-apps for the valid ids.',
                    implode(', ', $missing)
                ));
            }

            $written = $service->reorder($validated['orders']);

            return Response::structured([
                'reordered' => true,
                'apps_updated' => $written,
            ]);
        });
    }
}
