<?php

namespace App\Mcp\Tools\Promises;

use App\Models\Promise;
use App\Services\Promises\PromiseEditor;
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

#[Name('set-promise-status')]
#[Title('Set Promise Status')]
#[Description(
    'Rule on a promise: change its status and write that change, with its source, to the public change log. '
    .'Statuses: pending and in_progress are open; fulfilled, partially_fulfilled, broken, postponed and retracted '
    .'are verdicts that freeze the counter on their date. Overdue is shown automatically, so never mark a promise '
    .'broken only because its deadline passed: a verdict needs evidence, cited in source_url. The date cannot be '
    .'before the statement or the previous status change, or in the future. Once a promise has been public its '
    .'status changes are permanent; correct one by setting another status.'
)]
#[IsDestructive]
#[IsIdempotent]
class SetPromiseStatusTool extends PromisesTool
{
    protected array $permissions = ['promises.rule'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('UUID of the promise.')
                ->required(),

            'status' => $schema->string()
                ->description('The new status; it must differ from the current one.')
                ->enum(Promise::statuses())
                ->required(),

            'happened_on' => $schema->string()
                ->description('When it happened (YYYY-MM-DD), as the source dates it. Required.')
                ->required(),

            'source_url' => $schema->string()
                ->description('Evidence for the change (http/https). Required.')
                ->max(2048)
                ->required(),

            'archive_url' => $schema->string()
                ->description('Optional archived copy of the source (http/https).')
                ->max(2048),

            'body' => $schema->string()
                ->description('Optional explanation shown in the public log, in Arabic. Max 2000 characters.')
                ->max(2000),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        return $this->attempt(function () use ($request, $context) {
            $promise = $this->findPromise((string) $request->get('id'));

            $rules = app(PromiseRules::class);
            $data = $request->validate(['id' => 'required|string', ...$rules->status($promise)], $rules->messages());

            $promise = app(PromiseEditor::class)->changeStatus($promise, $data['status'], $data, $context->user);

            return Response::structured([
                'status' => $promise->status,
                'promise' => app(PromisePresenter::class)->adminDetail($promise),
            ]);
        });
    }
}
