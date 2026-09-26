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

/**
 * The fields a transit route exposes to an agent.
 *
 * `city_id` is deliberately absent: moving a governorate is its own tool,
 * because it carries stop and cache consequences the caller should opt into
 * explicitly rather than as one field among many. `status` is absent for the
 * same reason — it has its own tool with its own history entry.
 */
final class RouteFields
{
    /**
     * @var array<int, string>
     */
    public const EDITABLE = [
        'name_ar', 'name_en', 'color_index', 'price_new', 'price_old',
    ];
}

#[Name('update-transit-route')]
#[Title('Update Transit Route')]
#[Description(
    'Edit a transit route by hand. Every argument is optional and only what you pass is changed; pass an '
    .'explicit null to clear an optional field. This does not change the publication status — use '
    .'set-transit-route-status — and does not move the route between governorates. Route geometry and stops '
    .'are not editable here; they change through draft approval.'
)]
#[IsDestructive]
#[IsIdempotent]
class UpdateTransitRouteTool extends TransitTool
{
    protected array $permissions = ['transit.edit_routes'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'route_id' => $schema->string()
                ->description('Id of the route to update. Get it from list-transit-routes.')
                ->required(),

            'name_ar' => $schema->string()
                ->description('New Arabic name. Pass null to clear it, though a route without a name is not useful.'),

            'name_en' => $schema->string()
                ->description('New English name. Pass null to clear it.'),

            'color_index' => $schema->integer()
                ->description('New colour index, matching the palette used on the map.')
                ->min(0),

            'price_new' => $schema->integer()
                ->description('Current fare. Pass null to clear it.'),

            'price_old' => $schema->integer()
                ->description('Previous fare, shown struck through when it differs. Pass null to clear it.'),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'route_id' => 'required|string|max:191',
            'name_ar' => 'nullable|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'color_index' => 'nullable|integer|min:0',
            'price_new' => 'nullable|integer',
            'price_old' => 'nullable|integer',
        ]);

        return $this->attempt(function () use ($request, $validated, $context) {
            $service = app(TransitAdminService::class);
            $route = $service->findRoute($validated['route_id']);

            $this->guardCity($context, 'transit.edit_routes', $route->city_id);

            // $request->has() semantics: an explicit null is an instruction to
            // clear the column, so only wholly-absent keys are dropped.
            $data = array_intersect_key($validated, array_flip(RouteFields::EDITABLE));

            foreach (RouteFields::EDITABLE as $field) {
                if (! $request->has($field)) {
                    unset($data[$field]);
                }
            }

            $updated = $service->updateRoute($route, $data, $context->id());

            return Response::structured([
                'updated' => true,
                'changed_fields' => array_keys($data),
                'route' => app(TransitPresenter::class)->route($updated->fresh()),
            ]);
        });
    }
}
