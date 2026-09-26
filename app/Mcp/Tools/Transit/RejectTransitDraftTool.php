<?php

namespace App\Mcp\Tools\Transit;

use App\Models\Route;
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

#[Name('reject-transit-draft')]
#[Title('Reject Transit Draft')]
#[Description(
    'Reject a pending transit route draft. Give a reason: the contributor sees it, so a specific, '
    .'actionable reason ("the name is misspelled", "this duplicates route X") is far more useful than a '
    .'blanket refusal. When the draft was an edit to a live route, rejecting also puts that route back on '
    .'the public map, because submitting an edit had taken it offline. Only pending drafts can be rejected.'
)]
#[IsDestructive]
#[IsIdempotent]
class RejectTransitDraftTool extends TransitTool
{
    protected array $permissions = ['transit.reject'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'draft_id' => $schema->integer()
                ->description('Id of the pending draft to reject. Get it from list-transit-drafts.')
                ->required(),

            'reason' => $schema->string()
                ->description('Why the draft was rejected, shown to the contributor. Optional but strongly recommended.')
                ->max(1000),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'draft_id' => 'required|integer|min:1',
            'reason' => 'nullable|string|max:1000',
        ]);

        return $this->attempt(function () use ($validated, $context) {
            $service = app(TransitAdminService::class);
            $draft = $service->findDraft($validated['draft_id']);

            $this->guardCity($context, 'transit.reject', $draft->city_id);

            if ($draft->route_id !== null) {
                $linkedCityId = Route::whereKey($draft->route_id)->value('city_id');
                $this->guardCity($context, 'transit.reject', $linkedCityId);
            }

            $service->rejectDraft($draft, $validated['reason'] ?? null, $context->id());

            return Response::structured([
                'rejected' => true,
                'draft_id' => $draft->id,
                'reason' => $validated['reason'] ?? null,
                'linked_route_republished' => $draft->route_id !== null,
            ]);
        });
    }
}
