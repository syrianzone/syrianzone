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
    'Update an unpublished promise. This is a full replacement — pass every field you want to keep '
    .'(call get-promise first and resend its values; sources are replaced wholesale). '
    .'Only unpublished promises can be edited.'
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
            ...$this->promiseFieldsSchema($schema),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        return $this->attempt(function () use ($request, $context) {
            $id = (string) $request->get('id');
            $promise = $this->findPromise($id);

            if ($promise->review_status === 'published') {
                return Response::error('This promise is published. Published promises are edited in the dashboard, not by agents.');
            }

            $rules = app(PromiseRules::class);
            $data = $request->validate([
                'id' => 'required|string',
                ...$rules->promise($promise),
            ], $rules->messages());

            unset($data['id']);

            $updated = app(PromiseEditor::class)->save($promise, $data, $context->user);

            return Response::structured([
                'updated' => true,
                'promise' => app(PromisePresenter::class)->adminDetail($updated),
            ]);
        });
    }
}
