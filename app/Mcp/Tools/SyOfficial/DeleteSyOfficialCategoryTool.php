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

#[Name('delete-syofficial-category')]
#[Title('Delete SyOfficial Category')]
#[Description(
    'Permanently delete a SyOfficial category and every entity inside it. This is a hard delete with no '
    .'recovery and no soft-delete tombstone. To retire a group while keeping its data, use '
    .'toggle-syofficial-category instead. The response reports how many entities were removed so you can '
    .'confirm the blast radius after the fact.'
)]
#[IsDestructive]
class DeleteSyOfficialCategoryTool extends SyOfficialTool
{
    protected array $permissions = ['syofficial.delete'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Id of the category to delete. Every entity in it is deleted too.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string|max:64',
        ]);

        return $this->attempt(function () use ($validated) {
            $deletedEntities = app(SyOfficialDirectoryService::class)->deleteCategory($validated['id']);

            return Response::structured([
                'deleted' => true,
                'id' => $validated['id'],
                'entities_deleted' => $deletedEntities,
                'warning' => $deletedEntities > 0
                    ? sprintf('%d entities were permanently deleted with this category.', $deletedEntities)
                    : 'The category had no entities.',
            ]);
        });
    }
}
