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

#[Name('create-promise-sector')]
#[Title('Create Promise Sector')]
#[Description(
    'Add a sector promises can be filed under, shown at the end of the list. Check list-promise-sectors first: '
    .'a new sector is only worth it when several promises fit none of the existing ones. Its id is permanent.'
)]
#[IsDestructive]
class CreatePromiseSectorTool extends PromisesTool
{
    protected array $permissions = ['promises.speakers'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Permanent slug: lowercase English letters, digits, - and _, starting with a letter. Max 32 characters.')
                ->max(32)
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

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $rules = app(PromiseRules::class);
        $data = $request->validate($rules->sector(creating: true), $rules->messages());

        return $this->attempt(function () use ($data) {
            $sector = app(PromiseSectorService::class)->create($data);

            return Response::structured([
                'created' => true,
                'sector' => app(PromisePresenter::class)->adminSector($sector),
            ]);
        });
    }
}
