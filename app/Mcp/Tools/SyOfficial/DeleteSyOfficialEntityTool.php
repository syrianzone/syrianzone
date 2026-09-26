<?php

namespace App\Mcp\Tools\SyOfficial;

use App\Services\SyOfficial\SyOfficialDirectoryService;
use App\Support\Agents\AgentContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('delete-syofficial-entity')]
#[Title('Delete SyOfficial Entity')]
#[Description(
    'Permanently delete one official entity. This is a hard delete: the row is gone, there is no '
    .'tombstone, and the id stays taken. To retire an entity while keeping its data, use '
    .'toggle-syofficial-entity instead.'
)]
#[IsDestructive]
class DeleteSyOfficialEntityTool extends SyOfficialTool
{
    protected array $permissions = ['syofficial.delete'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Id of the entity to delete permanently.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string|max:128',
        ]);

        return $this->attempt(function () use ($validated) {
            app(SyOfficialDirectoryService::class)->deleteEntity($validated['id']);

            return Response::structured([
                'deleted' => true,
                'id' => $validated['id'],
            ]);
        });
    }
}
