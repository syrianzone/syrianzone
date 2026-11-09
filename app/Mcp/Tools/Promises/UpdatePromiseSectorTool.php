<?php

namespace App\Mcp\Tools\Promises;

use App\Services\Promises\PromisePresenter;
use App\Services\Promises\PromiseRules;
use App\Services\Promises\PromiseSectorService;
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

#[Name('update-promise-sector')]
#[Title('Update Promise Sector')]
#[Description(
    'Rename a sector or change its icon. Its id never changes. The icon is kept when you leave it out.'
)]
#[IsDestructive]
#[IsIdempotent]
class UpdatePromiseSectorTool extends PromisesTool
{
    protected array $permissions = ['promises.speakers'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Id of the sector (from list-promise-sectors).')
                ->required(),

            'label' => $schema->string()
                ->description('Name shown on the site, in Arabic. Max 255 characters.')
                ->max(255)
                ->required(),

            'icon' => $schema->string()
                ->description('Icon key, e.g. "zap", "house", "heart-pulse", "graduation-cap"; an unknown key shows a generic icon.')
                ->max(64),
        ];
    }

    protected function notFoundHint(): string
    {
        return 'Call list-promise-sectors to find valid ids.';
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $rules = app(PromiseRules::class);
        $data = $request->validate(['id' => 'required|string', ...$rules->sector(creating: false)], $rules->messages());

        return $this->attempt(function () use ($data) {
            $service = app(PromiseSectorService::class);
            $sector = $service->update($service->find($data['id']), $data);

            return Response::structured([
                'updated' => true,
                'sector' => app(PromisePresenter::class)->adminSector($sector),
            ]);
        });
    }
}
