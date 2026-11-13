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

#[Name('undo-promise-status')]
#[Title('Undo Promise Status Change')]
#[Description(
    'Undo the latest status change of a promise that has never been published, for example to fix a researched '
    .'date before publication; the promise falls back to its previous status. Refused once the promise has ever '
    .'been public, and for any entry but the latest status change.'
)]
#[IsDestructive]
#[IsIdempotent]
class UndoPromiseStatusTool extends PromisesTool
{
    protected array $permissions = [PermissionCatalogue::PROMISES_RULE];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('UUID of the promise.')
                ->required(),

            'update_id' => $schema->integer()
                ->description('Id of the latest status_change entry (get-promise updates[].id).')
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
            $promise = app(PromiseEditor::class)->undoStatusChange(
                $this->findPromise($validated['id']), (int) $validated['update_id'],
            );

            return Response::structured([
                'status' => $promise->status,
                'promise' => app(PromisePresenter::class)->adminDetail($promise),
            ]);
        });
    }
}
