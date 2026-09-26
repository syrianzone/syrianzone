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
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('set-transit-route-status')]
#[Title('Set Transit Route Status')]
#[Description(
    'Set a transit route\'s publication status. Use "published" to put a route on the public map, '
    .'"disapproved" to withdraw it, and "hidden" to remove it without marking it disapproved. Every change '
    .'is recorded in the route\'s history with an Arabic description. A route whose status is already the '
    .'requested one is left alone and reported as a no-op.'
)]
#[IsDestructive]
#[IsIdempotent]
class SetTransitRouteStatusTool extends TransitTool
{
    protected array $permissions = ['transit.edit_routes'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'route_id' => $schema->string()
                ->description('Id of the route to change. Get it from list-transit-routes.')
                ->required(),

            'status' => $schema->string()
                ->enum([...ListTransitRoutesTool::STATUSES])
                ->description('The status to set.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'route_id' => 'required|string|max:191',
            'status' => 'required|string|in:published,disapproved,hidden',
        ]);

        return $this->attempt(function () use ($validated, $context) {
            $service = app(TransitAdminService::class);
            $route = $service->findRoute($validated['route_id']);

            $this->guardCity($context, 'transit.edit_routes', $route->city_id);

            $previous = $route->status;

            $route = $service->setRouteStatus($route, $validated['status'], $context->id());

            return Response::structured([
                'updated' => true,
                'previous_status' => $previous,
                'status' => $route->status,
                'route' => app(TransitPresenter::class)->route($route->fresh()),
            ]);
        });
    }
}
