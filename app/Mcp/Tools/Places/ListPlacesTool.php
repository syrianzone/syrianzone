<?php

namespace App\Mcp\Tools\Places;

use App\Services\Places\PlacePresenter;
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

#[Name('list-places')]
#[Title('List Places')]
#[Description(
    'List community-submitted places for moderation, newest first. Defaults to the pending queue, '
    .'which is the work queue for approving or rejecting submissions. Use a page number beyond 1 to work '
    .'through a backlog. Returns each place with its status, category, coordinates, submitter and photos.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListPlacesTool extends PlacesTool
{
    protected array $permissions = ['places.review'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'status' => $schema->string()
                ->enum([...PlacePresenter::STATUSES, 'all'])
                ->description('Moderation status to list. Defaults to "pending". Use "all" to include approved and rejected.')
                ->default('pending'),

            'page' => $schema->integer()
                ->description('Page number, starting at 1.')
                ->default(1)
                ->min(1),

            'per_page' => $schema->integer()
                ->description('Places per page. The dashboard uses 20; larger pages cost more context, so raise this only when you need to sweep a backlog quickly.')
                ->default(20)
                ->min(1)
                ->max(100),
        ];
    }

    public function outputSchema(JsonSchema $schema): array
    {
        return [
            'status' => $schema->string()->description('Status filter that was applied.'),
            'current_page' => $schema->integer(),
            'last_page' => $schema->integer(),
            'total' => $schema->integer(),
            'places' => $schema->array()
                ->description('The page of places, in the same shape the admin dashboard renders.')
                ->items($schema->object([
                    'id' => $schema->integer(),
                    'name' => $schema->string(),
                    'category' => $schema->string(),
                    'status' => $schema->string(),
                    'lat' => $schema->number(),
                    'lng' => $schema->number(),
                ])),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'status' => 'sometimes|in:pending,approved,rejected,all',
            'page' => 'sometimes|integer|min:1',
            'per_page' => 'sometimes|integer|min:1|max:100',
        ]);

        $status = $validated['status'] ?? 'pending';
        $perPage = $validated['per_page'] ?? 20;

        $presenter = app(PlacePresenter::class);
        $page = $presenter->paginate($status, $perPage, $context->id());

        return Response::structured([
            'status' => $status,
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'total' => $page->total(),
            'places' => $page->getCollection()->map(fn ($place) => $presenter->item($place))->all(),
        ]);
    }
}
