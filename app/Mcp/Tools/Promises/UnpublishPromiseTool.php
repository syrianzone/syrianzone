<?php

namespace App\Mcp\Tools\Promises;

use App\Services\Promises\PromiseModerationService;
use App\Services\Promises\PromisePresenter;
use App\Support\Agents\AgentContext;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('unpublish-promise')]
#[Title('Unpublish Promise')]
#[Description(
    'Take a published promise off the public site and back into the review queue. It keeps its public number and '
    .'its change log; status changes logged while it was public stay permanent. This is the reversible way to '
    .'hide a promise: prefer it over delete-promise.'
)]
#[IsDestructive]
#[IsIdempotent]
class UnpublishPromiseTool extends PromisesTool
{
    protected array $permissions = [PermissionCatalogue::PROMISES_REVIEW];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('UUID of the published promise.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate(['id' => 'required|string']);

        return $this->attempt(function () use ($validated, $context) {
            $promise = app(PromiseModerationService::class)->unpublish($this->findPromise($validated['id']), $context->user);

            return Response::structured([
                'unpublished' => true,
                'promise' => app(PromisePresenter::class)->adminDetail($promise),
            ]);
        });
    }
}
