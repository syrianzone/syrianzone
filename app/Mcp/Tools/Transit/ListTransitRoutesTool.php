<?php

namespace App\Mcp\Tools\Transit;

use App\Services\Transit\TransitAdminService;
use App\Services\Transit\TransitPresenter;
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

#[Name('list-transit-routes')]
#[Title('List Transit Routes')]
#[Description(
    'List the published transit routes, with their governorate, status, pricing, colour and stop count. '
    .'Use status to work on a specific queue: "disapproved" is where routes withdrawn for review land, and '
    .'"hidden" is where deliberately hidden ones sit. If the agent\'s operator is scoped to specific '
    .'governorates, only those appear.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListTransitRoutesTool extends TransitTool
{
    protected array $permissions = ['transit.review_drafts'];

    public const STATUSES = ['published', 'disapproved', 'hidden'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'status' => $schema->string()
                ->enum([...self::STATUSES, 'all'])
                ->description('Route status to list. Defaults to "all".')
                ->default('all'),

            'city_id' => $schema->string()
                ->description('Restrict to one governorate. Optional.'),
        ];
    }

    public function outputSchema(JsonSchema $schema): array
    {
        return [
            'count' => $schema->integer(),
            'scope' => $schema->array()
                ->description('The governorates this agent is restricted to; empty means unrestricted.')
                ->items($schema->string()),
            'routes' => $schema->array()
                ->items($schema->object([
                    'id' => $schema->string(),
                    'city_id' => $schema->string(),
                    'city_name_ar' => $schema->string()->nullable(),
                    'name_ar' => $schema->string(),
                    'name_en' => $schema->string()->nullable(),
                    'status' => $schema->string(),
                    'color_index' => $schema->integer()->nullable(),
                    'price_old' => $schema->integer()->nullable(),
                    'price_new' => $schema->integer()->nullable(),
                    'stops_count' => $schema->integer()->nullable(),
                    'created_at' => $schema->string()->nullable(),
                ])),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'status' => 'sometimes|in:'.implode(',', [...self::STATUSES, 'all']),
            'city_id' => 'sometimes|string|max:64',
        ]);

        $allowed = $context->allowedTransitCities();

        if (isset($validated['city_id'])) {
            $this->guardCity($context, 'transit.review_drafts', $validated['city_id']);

            $allowed = $allowed === null
                ? [$validated['city_id']]
                : array_values(array_intersect($allowed, [$validated['city_id']]));
        }

        $status = $validated['status'] ?? 'all';

        $routes = app(TransitAdminService::class)->routes($allowed)
            ->when($status !== 'all', fn ($q) => $q->where('status', $status));

        return Response::structured([
            'count' => $routes->count(),
            'scope' => $allowed ?? [],
            'routes' => app(TransitPresenter::class)->routes($routes),
        ]);
    }
}
