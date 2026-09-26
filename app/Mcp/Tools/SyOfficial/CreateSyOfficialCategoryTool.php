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

#[Name('create-syofficial-category')]
#[Title('Create SyOfficial Category')]
#[Description(
    'Create a new SyOfficial category. The id is a permanent slug you choose, in lowercase words and '
    .'dashes, and it cannot be changed later; it is the value every entity references. The new category '
    .'is appended to the end of the display order.'
)]
#[IsDestructive]
class CreateSyOfficialCategoryTool extends SyOfficialTool
{
    protected array $permissions = ['syofficial.create'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Permanent slug for the category, lowercase words and dashes only, e.g. "ministries". Cannot be changed later.')
                ->required(),

            'label_ar' => $schema->string()
                ->description('Arabic label, shown to Arabic-speaking visitors. Required.')
                ->required(),

            'label_en' => $schema->string()
                ->description('English label. Required.')
                ->required(),

            'icon' => $schema->string()
                ->description('Icon name. Optional, max 64 characters.')
                ->max(64),

            'is_active' => $schema->boolean()
                ->description('Defaults to true. Set false to create it hidden while you prepare it.')
                ->default(true),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string|max:64|alpha_dash',
            'label_ar' => 'required|string|max:255',
            'label_en' => 'required|string|max:255',
            'icon' => 'nullable|string|max:64',
            'is_active' => 'boolean',
        ]);

        return $this->attempt(function () use ($validated) {
            $category = app(SyOfficialDirectoryService::class)->createCategory($validated);

            return Response::structured([
                'created' => true,
                'category' => app(SyOfficialPresenter::class)->category($category),
            ]);
        });
    }
}
