<?php

namespace App\Mcp\Tools\Promises;

use App\Models\PromiseSector;
use App\Services\Promises\PromisePresenter;
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
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list-promise-sectors')]
#[Title('List Promise Sectors')]
#[Description(
    'List the promise sectors in display order, with whether each is shown and how many promises use it.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListPromiseSectorsTool extends PromisesTool
{
    protected array $permissions = [PermissionCatalogue::PROMISES_SPEAKERS];

    public function schema(JsonSchema $schema): array
    {
        return [];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        return $this->attempt(function () {
            $presenter = app(PromisePresenter::class);

            return Response::structured([
                'sectors' => app(PromiseSectorService::class)->list()
                    ->map(fn (PromiseSector $s) => $presenter->adminSector($s))
                    ->all(),
            ]);
        });
    }
}
