<?php

namespace App\Mcp\Tools\Promises;

use App\Services\Promises\PromiseEditor;
use App\Services\Promises\PromisePresenter;
use App\Services\Promises\PromiseRules;
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

#[Name('create-promise')]
#[Title('Create Promise')]
#[Description(
    'Draft a new promise in the tracker. The promise is created UNPUBLISHED (review_status=pending) and goes '
    .'to the human review queue; nothing becomes public immediately. All text content must be in Arabic. '
    .'Call get-promise-form-options and search-promise-speakers first. At least one source is required.'
)]
#[IsDestructive]
class CreatePromiseTool extends PromisesTool
{
    protected array $permissions = [PermissionCatalogue::PROMISES_CREATE];

    public function schema(JsonSchema $schema): array
    {
        return $this->promiseFieldsSchema($schema);
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $rules = app(PromiseRules::class);
        $data = $request->validate($rules->promise(), $rules->messages());

        return $this->attempt(function () use ($data, $context) {
            $promise = app(PromiseEditor::class)->save(null, $data + ['origin' => 'editor'], $context->user);

            return Response::structured([
                'created' => true,
                'promise' => app(PromisePresenter::class)->adminDetail($promise),
            ]);
        });
    }
}
