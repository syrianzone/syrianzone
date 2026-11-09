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

#[Name('update-promise')]
#[Title('Update Promise')]
#[Description(
    'Update a promise, published or not. This is a full replacement: call get-promise first and resend every '
    .'field you want to keep (sources are replaced wholesale). Pass the version you read as expected_version; '
    .'the update is refused if anyone changed the promise since, so you never overwrite a newer edit. '
    .'Changes to a published promise are public immediately. Verdicts are not changed here: use set-promise-status.'
)]
#[IsDestructive]
#[IsIdempotent]
class UpdatePromiseTool extends PromisesTool
{
    protected array $permissions = ['promises.edit'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('UUID of the promise to update. Required.')
                ->required(),
            'expected_version' => $schema->integer()
                ->description('The promise\'s version as get-promise returned it. Required.')
                ->min(0)
                ->required(),
            ...$this->promiseFieldsSchema($schema),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        return $this->attempt(function () use ($request, $context) {
            $promise = $this->findPromise((string) $request->get('id'));

            $rules = app(PromiseRules::class);
            $data = $request->validate([
                'id' => 'required|string',
                'expected_version' => 'required|integer|min:0',
                ...$rules->promise($promise),
            ], $rules->messages());

            $readVersion = (int) $data['expected_version'];
            unset($data['id'], $data['expected_version']);

            $updated = app(PromiseEditor::class)->saveIfUnchanged(
                $promise, $readVersion, $data, $context->user, $this->mayRule($context),
            );

            return Response::structured([
                'updated' => true,
                'promise' => app(PromisePresenter::class)->adminDetail($updated),
                ...$this->restatementNote($updated),
            ]);
        });
    }
}
