<?php

namespace App\Mcp\Tools\Places;

use App\Services\Places\PlaceModerationService;
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

#[Name('get-place')]
#[Title('Get Place')]
#[Description(
    'Fetch one place by id, including its full description, submitter, moderation status, rejection reason '
    .'and photo list. Read this before moderating a place so you are acting on current state rather than a '
    .'stale listing.'
)]
#[IsReadOnly]
#[IsIdempotent]
class GetPlaceTool extends PlacesTool
{
    protected array $permissions = ['places.review'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'place_id' => $schema->integer()
                ->description('Id of the place to fetch.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'place_id' => 'required|integer|min:1',
        ]);

        return $this->attempt(function () use ($validated, $context) {
            $presenter = app(PlacePresenter::class);

            $place = $presenter->present(
                app(PlaceModerationService::class)->findOrFail($validated['place_id']),
                $context->id(),
            );

            return Response::structured(['place' => $presenter->item($place)]);
        });
    }
}
