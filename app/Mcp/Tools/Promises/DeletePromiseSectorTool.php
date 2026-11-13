<?php

namespace App\Mcp\Tools\Promises;

use App\Services\Promises\PromiseSectorService;
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

#[Name('delete-promise-sector')]
#[Title('Delete Promise Sector')]
#[Description(
    'Delete a sector created by mistake. Refused while any promise, including a deleted one, uses it: hide it '
    .'with toggle-promise-sector instead.'
)]
#[IsDestructive]
class DeletePromiseSectorTool extends PromisesTool
{
    protected array $permissions = [PermissionCatalogue::PROMISES_SPEAKERS];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Id of the sector (from list-promise-sectors).')
                ->required(),
        ];
    }

    protected function notFoundHint(): string
    {
        return 'Call list-promise-sectors to find valid ids.';
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate(['id' => 'required|string']);

        return $this->attempt(function () use ($validated) {
            $service = app(PromiseSectorService::class);
            $service->delete($service->find($validated['id']));

            return Response::structured([
                'deleted' => true,
                'id' => $validated['id'],
            ]);
        });
    }
}
