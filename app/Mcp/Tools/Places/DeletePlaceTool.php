<?php

namespace App\Mcp\Tools\Places;

use App\Services\Places\PlaceModerationService;
use App\Support\Agents\AgentContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('delete-place')]
#[Title('Delete Place')]
#[Description(
    'Permanently delete a place and all of its photos. This removes the record from the map and cannot be '
    .'undone. Use it for spam and for places that should never have been submitted — for a place that is '
    .'simply mistaken, prefer update-place, and for one that is merely undecided, reject-place.'
)]
#[IsDestructive]
class DeletePlaceTool extends PlacesTool
{
    protected array $permissions = ['places.delete'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'place_id' => $schema->integer()
                ->description('Id of the place to delete permanently.')
                ->required(),

            'confirm' => $schema->boolean()
                ->description('Must be true. Guards against an agent deleting a place on a misread id — this operation cannot be undone.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'place_id' => 'required|integer|min:1',
            'confirm' => 'required|boolean',
        ]);

        if (! $validated['confirm']) {
            return Response::error(
                'Refusing to delete: pass confirm=true once you have verified the place id with get-place. Deletion is permanent.'
            );
        }

        return $this->attempt(function () use ($validated) {
            app(PlaceModerationService::class)->delete($validated['place_id']);

            return Response::structured([
                'id' => $validated['place_id'],
                'deleted' => true,
            ]);
        });
    }
}
