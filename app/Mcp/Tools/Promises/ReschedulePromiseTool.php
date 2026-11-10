<?php

namespace App\Mcp\Tools\Promises;

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

#[Name('reschedule-promise')]
#[Title('Reschedule Promise')]
#[Description(
    'Reschedule a promise deadline in place: set a new deadline date and optional wording/reasoning, '
    .'and record the revision in the public change log with a deadline_change entry. '
    .'Preserves the original deadline on first revision, increments postponed_count, and reopens postponed promises.'
)]
#[IsDestructive]
#[IsIdempotent]
class ReschedulePromiseTool extends PromisesTool
{
    protected array $permissions = ['promises.rule'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('UUID of the promise.')
                ->required(),

            'deadline_date' => $schema->string()
                ->description('New deadline date (YYYY-MM-DD), on or after statement date. Required.')
                ->required(),

            'deadline_wording' => $schema->string()
                ->description('Optional revised wording of the deadline (e.g. "خلال عام 2026").')
                ->max(255),

            'deadline_reasoning' => $schema->string()
                ->description('Optional explanation of how the new deadline date was derived.')
                ->max(2000),

            'happened_on' => $schema->string()
                ->description('When the postponement or deadline change was announced (YYYY-MM-DD). Required.')
                ->required(),

            'source_url' => $schema->string()
                ->description('Evidence URL for the deadline revision (http/https). Required.')
                ->max(2048)
                ->required(),

            'archive_url' => $schema->string()
                ->description('Optional archived copy of the source (http/https).')
                ->max(2048),

            'body' => $schema->string()
                ->description('Optional public log entry description in Arabic.')
                ->max(2000),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        return $this->attempt(function () use ($request, $context) {
            $promise = $this->findPromise((string) $request->get('id'));

            $rules = app(PromiseRules::class);
            $data = $request->validate([
                'id' => ['required', 'string'],
                ...$rules->reschedule($promise),
            ], $rules->messages());

            $promise = app(PromiseEditor::class)->rescheduleDeadline($promise, $data, $context->user);

            return Response::structured([
                'deadlineDate' => $promise->deadline_date?->format('Y-m-d'),
                'promise' => app(PromisePresenter::class)->adminDetail($promise),
            ]);
        });
    }
}
