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

/**
 * The transit audit trail, which is also how you answer "what happened to this
 * route" — every approve, reject, status change, move, edit and delete writes an
 * entry here with an Arabic description, so an agent can reconstruct a route's
 * recent history without a human.
 */
#[Name('list-transit-route-history')]
#[Title('List Transit Route History')]
#[Description(
    'List the transit audit trail, newest first. Every approve, reject, status change, move, manual edit and '
    .'deletion records an entry here, so this is how to find out what happened to a route. Entries are '
    .'filtered to the agent\'s governorate scope. Descriptions are in Arabic, as the admin panel writes them.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListTransitRouteHistoryTool extends TransitTool
{
    protected array $permissions = ['transit.review_drafts'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'route_id' => $schema->string()
                ->description('Restrict to one route. Optional; omit for everything in scope.'),

            'limit' => $schema->integer()
                ->description('Maximum entries to return. Defaults to 50, hard maximum 200 — the admin dashboard caps at 200.')
                ->default(50)
                ->min(1)
                ->max(200),
        ];
    }

    public function outputSchema(JsonSchema $schema): array
    {
        return [
            'count' => $schema->integer(),
            'entries' => $schema->array()
                ->items($schema->object([
                    'id' => $schema->integer(),
                    'route_id' => $schema->string(),
                    'action' => $schema->string()->description('Machine-readable action, e.g. combined, moved, restored_after_reject, deleted.'),
                    'description' => $schema->string()->description('Human-readable Arabic description written by the admin panel.'),
                    'actor' => $schema->string()->nullable(),
                    'created_at' => $schema->string()->nullable(),
                ])),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'route_id' => 'sometimes|string|max:191',
            'limit' => 'sometimes|integer|min:1|max:200',
        ]);

        $allowed = $context->allowedTransitCities();

        $logs = app(TransitAdminService::class)->logs($allowed, $validated['limit'] ?? 50)
            ->when(
                isset($validated['route_id']),
                fn ($q) => $q->where('route_id', $validated['route_id'])
            );

        return Response::structured([
            'count' => $logs->count(),
            'entries' => app(TransitPresenter::class)->logs($logs),
        ]);
    }
}
