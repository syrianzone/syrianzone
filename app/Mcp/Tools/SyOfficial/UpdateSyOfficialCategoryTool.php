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

#[Name('update-syofficial-category')]
#[Title('Update SyOfficial Category')]
#[Description(
    'Edit a SyOfficial category\'s labels and icon. The id cannot be changed. This tool does not change '
    .'the active flag — use toggle-syofficial-category for that, so hiding a category stays a separate, '
    .'deliberate step.'
)]
#[IsDestructive]
#[IsIdempotent]
class UpdateSyOfficialCategoryTool extends SyOfficialTool
{
    protected array $permissions = ['syofficial.edit'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Id of the category to update.')
                ->required(),

            'label_ar' => $schema->string()->description('New Arabic label. Required.')->required(),

            'label_en' => $schema->string()->description('New English label. Required.')->required(),

            'icon' => $schema->string()
                ->description('New icon name. Optional, max 64 characters. Pass null to clear it.')
                ->max(64),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string|max:64',
            'label_ar' => 'required|string|max:255',
            'label_en' => 'required|string|max:255',
            'icon' => 'nullable|string|max:64',
        ]);

        return $this->attempt(function () use ($validated) {
            $category = app(SyOfficialDirectoryService::class)->updateCategory(
                $validated['id'],
                array_diff_key($validated, ['id' => null]),
            );

            return Response::structured([
                'updated' => true,
                'category' => app(SyOfficialPresenter::class)->category($category),
            ]);
        });
    }
}
