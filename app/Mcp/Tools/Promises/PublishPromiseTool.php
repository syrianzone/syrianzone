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

#[Name('publish-promise')]
#[Title('Publish Promise')]
#[Description(
    'Publish an unpublished promise to the public tracker, where it gets a permanent public number. '
    .'Check it first with get-promise: the quote against its sources, the deadline interpretation, the sector. '
    .'It needs at least one source and a speaker who is not rejected; a pending speaker is approved with it. '
    .'If it restates an earlier open promise, the original is marked postponed only when this agent also holds '
    .'promises.rule. unpublish-promise takes it down again and it keeps its number.'
)]
#[IsDestructive]
#[IsIdempotent]
class PublishPromiseTool extends PromisesTool
{
    protected array $permissions = [PermissionCatalogue::PROMISES_REVIEW];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('UUID of the unpublished promise (from get-promise-review-queue or list-promises).')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate(['id' => 'required|string']);

        return $this->attempt(function () use ($validated, $context) {
            $promise = app(PromiseModerationService::class)->publish(
                $this->findPromise($validated['id']), $context->user, $this->mayRule($context),
            );

            return Response::structured([
                'published' => true,
                'number' => $promise->number,
                'url' => url('/promises/'.$promise->number),
                'promise' => app(PromisePresenter::class)->adminDetail($promise),
                ...$this->restatementNote($promise),
            ]);
        });
    }
}
