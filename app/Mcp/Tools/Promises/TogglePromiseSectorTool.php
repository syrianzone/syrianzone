<?php

namespace App\Mcp\Tools\Promises;

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
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('toggle-promise-sector')]
#[Title('Show or Hide Promise Sector')]
#[Description(
    'Show or hide a sector. Hiding keeps it and its promises intact, so it is the reversible way to retire a '
    .'sector: prefer it over delete-promise-sector.'
)]
#[IsDestructive]
#[IsIdempotent]
class TogglePromiseSectorTool extends PromisesTool
{
    protected array $permissions = [PermissionCatalogue::PROMISES_SPEAKERS];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Id of the sector (from list-promise-sectors).')
                ->required(),

            'is_active' => $schema->boolean()
                ->description('True to show it, false to hide it.')
                ->required(),
        ];
    }

    protected function notFoundHint(): string
    {
        return 'Call list-promise-sectors to find valid ids.';
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string',
            'is_active' => 'required|boolean',
        ]);

        return $this->attempt(function () use ($validated) {
            $service = app(PromiseSectorService::class);
            $sector = $service->setActive($service->find($validated['id']), (bool) $validated['is_active']);

            return Response::structured([
                'is_active' => $sector->is_active,
                'sector' => app(PromisePresenter::class)->adminSector($sector),
            ]);
        });
    }
}
