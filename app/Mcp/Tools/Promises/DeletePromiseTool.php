<?php

namespace App\Mcp\Tools\Promises;

use App\Services\Promises\PromiseEditor;
use App\Support\Agents\AgentContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('delete-promise')]
#[Title('Delete Promise')]
#[Description(
    'Delete a promise from the tracker and the public site, for a duplicate or an entry that should never have '
    .'existed. There is no restore tool, and its public number is never reused. To take a promise off the site '
    .'reversibly, use unpublish-promise instead.'
)]
#[IsDestructive]
class DeletePromiseTool extends PromisesTool
{
    protected array $permissions = ['promises.delete'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('UUID of the promise to delete.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate(['id' => 'required|string']);

        return $this->attempt(function () use ($validated) {
            $promise = $this->findPromise($validated['id']);
            app(PromiseEditor::class)->delete($promise);

            return Response::structured([
                'deleted' => true,
                'id' => $promise->id,
                'number' => $promise->number,
            ]);
        });
    }
}
