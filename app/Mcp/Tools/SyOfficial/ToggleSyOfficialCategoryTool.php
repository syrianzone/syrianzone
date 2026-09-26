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

#[Name('toggle-syofficial-category')]
#[Title('Show or Hide SyOfficial Category')]
#[Description(
    'Set a SyOfficial category active or inactive. Hiding a category takes it off the public site but '
    .'keeps it and its entities, so this is the reversible way to retire a group. Prefer it over deleting.'
)]
#[IsDestructive]
#[IsIdempotent]
class ToggleSyOfficialCategoryTool extends SyOfficialTool
{
    protected array $permissions = ['syofficial.toggle'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Id of the category to show or hide.')
                ->required(),

            'is_active' => $schema->boolean()
                ->description('True to show it publicly, false to hide it.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string|max:64',
            'is_active' => 'required|boolean',
        ]);

        return $this->attempt(function () use ($validated) {
            $category = app(SyOfficialDirectoryService::class)->setCategoryActive(
                $validated['id'],
                (bool) $validated['is_active'],
            );

            return Response::structured([
                'is_active' => $category->is_active,
                'category' => app(SyOfficialPresenter::class)->category($category),
            ]);
        });
    }
}
