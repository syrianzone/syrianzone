<?php

namespace App\Mcp\Tools\Promises;

use App\Services\Promises\PromiseModerationService;
use App\Services\Promises\PromisePresenter;
use App\Services\Promises\PromiseRules;
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

#[Name('reject-promise')]
#[Title('Reject Promise')]
#[Description(
    'Reject an unpublished promise, typically a public suggestion that is unsourced, a duplicate, or not a promise. '
    .'Only promises waiting in the review queue can be rejected; a published one must be unpublished first. '
    .'Give a short reason in Arabic.'
)]
#[IsDestructive]
#[IsIdempotent]
class RejectPromiseTool extends PromisesTool
{
    protected array $permissions = ['promises.review'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('UUID of the unpublished promise.')
                ->required(),

            'reason' => $schema->string()
                ->description('Why it was rejected, in Arabic. Max 1000 characters.')
                ->max(1000),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $rules = app(PromiseRules::class);
        $validated = $request->validate(['id' => 'required|string', ...$rules->reason()], $rules->messages());

        return $this->attempt(function () use ($validated, $context) {
            $promise = app(PromiseModerationService::class)->reject(
                $this->findPromise($validated['id']), $context->user, $validated['reason'] ?? null,
            );

            return Response::structured([
                'rejected' => true,
                'promise' => app(PromisePresenter::class)->adminDetail($promise),
            ]);
        });
    }
}
