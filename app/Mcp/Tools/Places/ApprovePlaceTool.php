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
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('approve-place')]
#[Title('Approve Place')]
#[Description(
    'Approve a pending community-submitted place, publishing it to the public map. '
    .'Only pending places can be approved. Prefer approving over rejecting unless the submission is '
    .'clearly wrong: approval is reversible by deleting the place, rejection is not a moderation state you '
    .'can leave from.'
)]
#[IsDestructive]
#[IsIdempotent]
class ApprovePlaceTool extends PlacesTool
{
    protected array $permissions = ['places.approve'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'place_id' => $schema->integer()
                ->description('Id of the pending place to approve and publish.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'place_id' => 'required|integer|min:1',
        ]);

        return $this->attempt(function () use ($validated, $context) {
            $place = app(PlaceModerationService::class)->approve($validated['place_id']);

            return Response::structured([
                'id' => $place->id,
                'status' => 'approved',
                'approved_at' => $place->approved_at?->toIso8601String(),
                'place' => $this->placePayload($place, $context->id()),
            ]);
        });
    }
}
