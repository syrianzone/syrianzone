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
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

/**
 * Move a route between governorates. Gated on the same capability as the other
 * route edits, because it is one — but it carries stop and cache consequences
 * the other edits do not, which is why it is its own tool rather than a field
 * on update-transit-route.
 */
#[Name('move-transit-route')]
#[Title('Move Transit Route Between Governorates')]
#[Description(
    'Move a transit route to a different governorate, carrying its stops with it. A stop belonging to no '
    .'other route is simply re-pointed at the new governorate; a stop still shared with a route left behind '
    .'is copied, so the other route keeps its own. The route must not already be in the target governorate. '
    .'This does not change the route\'s status or name, and it does not move any other route.'
)]
#[IsDestructive]
#[IsIdempotent]
class MoveTransitRouteTool extends TransitTool
{
    protected array $permissions = ['transit.edit_routes'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'route_id' => $schema->string()
                ->description('Id of the route to move.')
                ->required(),

            'city_id' => $schema->string()
                ->description('Id of the governorate to move it into, for example "aleppo". Must differ from the route\'s current governorate.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'route_id' => 'required|string|max:191',
            'city_id' => 'required|string|max:64',
        ]);

        return $this->attempt(function () use ($validated, $context) {
            $service = app(TransitAdminService::class);
            $route = $service->findRoute($validated['route_id']);

            $from = $route->city_id;
            $to = $validated['city_id'];

            // Both ends of the move are checked: an agent allowed to work in the
            // source but not the target must not be able to relocate data out of
            // its scope, and vice versa.
            $this->guardCity($context, 'transit.edit_routes', $from);
            $this->guardCity($context, 'transit.edit_routes', $to);

            $moved = $service->moveRoute($route, $to, $context->id());

            return Response::structured([
                'moved' => true,
                'from_city_id' => $from,
                'to_city_id' => $moved->fresh()->city_id,
                'route_id' => $moved->id,
            ]);
        });
    }
}
