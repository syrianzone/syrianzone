<?php

namespace App\Mcp\Tools\Transit;

use App\Models\Route;
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
 * Approve a draft, publishing it as a new route or applying it to the existing
 * route it edits.
 */
#[Name('approve-transit-draft')]
#[Title('Approve Transit Draft')]
#[Description(
    'Approve a pending transit route draft. When the draft proposes a brand new route this publishes it. '
    .'When the draft is an edit to an existing route, the reviewed geometry, stops and names replace that '
    .'route\'s, and the route is republished — a submitted edit takes the route off the public map while it '
    .'waits, so approving is what puts it back. Only pending drafts can be approved. Set color_index to '
    .'override the colour the contributor picked, or omit it to keep theirs.'
)]
#[IsDestructive]
#[IsIdempotent]
class ApproveTransitDraftTool extends TransitTool
{
    protected array $permissions = ['transit.approve'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'draft_id' => $schema->integer()
                ->description('Id of the pending draft to approve. Get it from list-transit-drafts.')
                ->required(),

            'color_index' => $schema->integer()
                ->description('Colour to publish with. Optional — omit to keep the colour the contributor chose.')
                ->min(0),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'draft_id' => 'required|integer|min:1',
            'color_index' => 'nullable|integer|min:0',
        ]);

        return $this->attempt(function () use ($validated, $context) {
            $service = app(TransitAdminService::class);
            $draft = $service->findDraft($validated['draft_id']);

            // Scope is checked against the governorate the draft actually sits
            // in, not against anything the caller supplied — there is no city
            // argument to trust here.
            $this->guardCity($context, 'transit.approve', $draft->city_id);

            // A linked edit touches a second governorate's route, so that one is
            // checked too. Same rule the dashboard applies.
            if ($draft->route_id !== null) {
                $linkedCityId = Route::whereKey($draft->route_id)->value('city_id');
                $this->guardCity($context, 'transit.approve', $linkedCityId);
            }

            $route = $service->approveDraft(
                $draft,
                $validated['color_index'] ?? null,
                $context->id(),
            );

            $presenter = app(TransitPresenter::class);

            return Response::structured([
                'approved' => true,
                'draft_id' => $draft->id,
                'published_new_route' => $draft->route_id === null,
                'route' => $presenter->route($route->fresh()),
            ]);
        });
    }
}
