<?php

namespace App\Mcp\Tools\SyOfficial;

use App\Services\SyOfficial\SyOfficialDirectoryService;
use App\Services\SyOfficial\SyOfficialPresenter;
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

#[Name('toggle-syofficial-entity')]
#[Title('Show or Hide SyOfficial Entity')]
#[Description(
    'Set an official entity active or inactive. Hiding removes it from the public directory while keeping '
    .'it and its position, so this is the reversible alternative to deleting.'
)]
#[IsDestructive]
#[IsIdempotent]
class ToggleSyOfficialEntityTool extends SyOfficialTool
{
    protected array $permissions = ['syofficial.toggle'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Id of the entity to show or hide.')
                ->required(),

            'is_active' => $schema->boolean()
                ->description('True to show it publicly, false to hide it.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string|max:128',
            'is_active' => 'required|boolean',
        ]);

        return $this->attempt(function () use ($validated) {
            $entity = app(SyOfficialDirectoryService::class)->setEntityActive(
                $validated['id'],
                (bool) $validated['is_active'],
            );

            return Response::structured([
                'is_active' => $entity->is_active,
                'entity' => app(SyOfficialPresenter::class)->entity($entity->fresh()),
            ]);
        });
    }
}
