<?php

namespace App\Mcp\Tools\Transit;

use App\Services\Transit\TransitAdminService;
use App\Support\Agents\AgentContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('delete-transit-route')]
#[Title('Delete Transit Route')]
#[Description(
    'Permanently delete a transit route, together with its geometry and its stop links. Stops that no '
    .'other route references any more are removed as well; stops still in use elsewhere are kept. The '
    .'response reports how many stops went with it. This is a hard delete with no undo — to take a route '
    .'off the map without losing it, use set-transit-route-status with "disapproved" instead.'
)]
#[IsDestructive]
class DeleteTransitRouteTool extends TransitTool
{
    protected array $permissions = ['transit.delete_routes'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'route_id' => $schema->string()
                ->description('Id of the route to delete permanently.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'route_id' => 'required|string|max:191',
        ]);

        return $this->attempt(function () use ($validated, $context) {
            $service = app(TransitAdminService::class);
            $route = $service->findRoute($validated['route_id']);

            $this->guardCity($context, 'transit.delete_routes', $route->city_id);

            $stopsRemoved = $service->destroyRoute($route, $context->id());

            return Response::structured([
                'deleted' => true,
                'route_id' => $route->id,
                'stops_deleted' => $stopsRemoved,
            ]);
        });
    }
}
