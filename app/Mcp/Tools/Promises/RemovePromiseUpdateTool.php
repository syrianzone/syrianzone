<?php

namespace App\Mcp\Tools\Promises;

use App\Services\Promises\PromiseEditor;
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

#[Name('remove-promise-update')]
#[Title('Remove Promise Update')]
#[Description(
    'Remove a progress reading, official response, or note from a promise\'s change log. '
    .'Status-change entries are refused: use undo-promise-status, which only works before the promise is ever published.'
)]
#[IsDestructive]
#[IsIdempotent]
class RemovePromiseUpdateTool extends PromisesTool
{
    protected array $permissions = [PermissionCatalogue::PROMISES_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('UUID of the promise. Required.')
                ->required(),

            'update_id' => $schema->integer()
                ->description('Integer ID of the update entry to remove (from get-promise updates[].id). Required.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string',
            'update_id' => 'required|integer',
        ]);

        return $this->attempt(function () use ($validated) {
            $promise = $this->findPromise((string) $validated['id']);

            app(PromiseEditor::class)->removeUpdate($promise, (int) $validated['update_id']);

            return Response::structured([
                'removed' => true,
                'promise' => app(PromisePresenter::class)->adminDetail($promise->fresh()),
            ]);
        });
    }
}
