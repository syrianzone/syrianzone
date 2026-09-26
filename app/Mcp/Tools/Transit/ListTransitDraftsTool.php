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

#[Name('list-transit-drafts')]
#[Title('List Transit Drafts')]
#[Description(
    'List community-submitted transit route drafts awaiting review, newest first. This is the transit '
    .'work queue: reviewing each one means approving it to publish the route, or rejecting it with a '
    .'reason. If the agent\'s operator is scoped to specific governorates, only drafts in those '
    .'governorates appear, and a scope field reports the restriction. Coordinates are not included; use '
    .'get-transit-draft-geometry when you need to see the shape before deciding.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListTransitDraftsTool extends TransitTool
{
    protected array $permissions = ['transit.review_drafts'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'status' => $schema->string()
                ->enum(['pending', 'approved', 'rejected', 'all'])
                ->description('Draft status to list. Defaults to "pending", the review queue.')
                ->default('pending'),

            'city_id' => $schema->string()
                ->description('Restrict to one governorate. Optional; use it to focus on one region.'),

            'limit' => $schema->integer()
                ->description('Maximum drafts to return. Defaults to 100, hard maximum 500 — the admin dashboard itself caps at 500 because the table grows without limit.')
                ->default(100)
                ->min(1)
                ->max(500),
        ];
    }

    public function outputSchema(JsonSchema $schema): array
    {
        return [
            'count' => $schema->integer(),
            'scope' => $schema->array()
                ->description('The governorates this agent is restricted to; empty means unrestricted.')
                ->items($schema->string()),
            'drafts' => $schema->array()
                ->items($schema->object([
                    'id' => $schema->integer(),
                    'city_id' => $schema->string(),
                    'city_name_ar' => $schema->string()->nullable(),
                    'name_ar' => $schema->string(),
                    'name_en' => $schema->string()->nullable(),
                    'price' => $schema->integer()->nullable(),
                    'color_index' => $schema->integer()->nullable(),
                    'status' => $schema->string(),
                    'rejection_reason' => $schema->string()->nullable(),
                    'route_id' => $schema->string()->nullable()->description('Set when this draft edits an existing route rather than proposing a new one.'),
                    'linked_route_name_ar' => $schema->string()->nullable(),
                    'contributor' => $schema->string()->nullable(),
                    'feature_count' => $schema->integer()->description('How many GeoJSON features the draft carries: one line plus one point per stop.'),
                    'created_at' => $schema->string()->nullable(),
                ])),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'status' => 'sometimes|in:pending,approved,rejected,all',
            'city_id' => 'sometimes|string|max:64',
            'limit' => 'sometimes|integer|min:1|max:500',
        ]);

        $limit = $validated['limit'] ?? 100;
        $service = app(TransitAdminService::class);

        // Start from the operator's governorate scope and let an explicit
        // city_id narrow it further. An agent can never widen past its own
        // scope: if the requested city is outside it, the intersection is empty.
        $allowed = $context->allowedTransitCities();

        if (isset($validated['city_id'])) {
            $this->guardCity($context, 'transit.review_drafts', $validated['city_id']);

            $allowed = $allowed === null
                ? [$validated['city_id']]
                : array_values(array_intersect($allowed, [$validated['city_id']]));
        }

        $drafts = $service->drafts($allowed, $limit)
            ->when(
                ($validated['status'] ?? 'pending') !== 'all',
                fn ($q) => $q->where('status', $validated['status'] ?? 'pending')
            );

        $presenter = app(TransitPresenter::class);

        return Response::structured([
            'count' => $drafts->count(),
            'scope' => $allowed ?? [],
            'drafts' => $presenter->drafts($drafts),
        ]);
    }
}
