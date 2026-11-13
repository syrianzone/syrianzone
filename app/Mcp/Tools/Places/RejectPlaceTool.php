<?php

namespace App\Mcp\Tools\Places;

use App\Services\Places\PlaceModerationService;
use App\Support\Agents\AgentContext;
use App\Support\Permissions\PermissionCatalogue;
use App\Support\RejectionReason;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('reject-place')]
#[Title('Reject Place')]
#[Description(
    'Reject a pending community-submitted place. Give a short reason: it is shown to the submitter, so '
    .'say what was wrong and what would make it acceptable. Only pending places can be rejected.'
)]
#[IsDestructive]
#[IsIdempotent]
class RejectPlaceTool extends PlacesTool
{
    protected array $permissions = [PermissionCatalogue::PLACES_APPROVE];

    public function schema(JsonSchema $schema): array
    {
        return [
            'place_id' => $schema->integer()
                ->description('Id of the pending place to reject.')
                ->required(),

            'reason' => $schema->string()
                ->description('Short, specific reason shown to the submitter. Explain what was wrong and what a resubmission should fix. Max '.RejectionReason::MAX_LENGTH.' characters.')
                ->max(RejectionReason::MAX_LENGTH),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'place_id' => 'required|integer|min:1',
            'reason' => RejectionReason::rules(),
        ], RejectionReason::messages());

        return $this->attempt(function () use ($validated) {
            $place = app(PlaceModerationService::class)->reject(
                $validated['place_id'],
                $validated['reason'] ?? null,
            );

            return Response::structured([
                'id' => $place->id,
                'status' => 'rejected',
                'rejection_reason' => $place->rejection_reason,
            ]);
        });
    }
}
