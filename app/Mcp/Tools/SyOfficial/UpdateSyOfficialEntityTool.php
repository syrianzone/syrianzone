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

#[Name('update-syofficial-entity')]
#[Title('Update SyOfficial Entity')]
#[Description(
    'Edit an official entity. Every argument is optional and only what you pass is changed — omitting '
    .'socials leaves the existing links intact rather than clearing them. This tool does not change the '
    .'active flag; use toggle-syofficial-entity. The id cannot be changed.'
)]
#[IsDestructive]
#[IsIdempotent]
class UpdateSyOfficialEntityTool extends SyOfficialTool
{
    protected array $permissions = ['syofficial.edit'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Id of the entity to update.')
                ->required(),

            'category_id' => $schema->string()
                ->description('Move the entity to a different category. Optional; the display order is per category, so this changes its position.'),

            'name' => $schema->string()->description('New English name.'),

            'name_ar' => $schema->string()->description('New Arabic name.'),

            'description' => $schema->string()->description('New English description. Pass null to clear it.'),

            'description_ar' => $schema->string()->description('New Arabic description. Pass null to clear it.'),

            'socials' => $schema->array()
                ->description('Replace the link list. Omit to leave it alone; pass an empty array to clear every link. Only http and https survive.')
                ->items($schema->string()->max(2048)),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string|max:128',
            'category_id' => 'sometimes|string|max:64',
            'name' => 'sometimes|string|max:255',
            'name_ar' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'description_ar' => 'nullable|string',
            'socials' => 'sometimes|array',
            'socials.*' => 'nullable|string|max:2048',
        ]);

        return $this->attempt(function () use ($validated) {
            $attributes = array_diff_key($validated, ['id' => null, 'socials' => null]);

            $entity = app(SyOfficialDirectoryService::class)->updateEntity(
                $validated['id'],
                $attributes,
                // null means "not supplied", which leaves the links alone. Only
                // an explicit array replaces them.
                $validated['socials'] ?? null,
            );

            return Response::structured([
                'updated' => true,
                'entity' => app(SyOfficialPresenter::class)->entity($entity->fresh()),
            ]);
        });
    }
}
