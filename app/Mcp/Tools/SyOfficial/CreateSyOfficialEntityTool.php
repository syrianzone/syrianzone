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

#[Name('create-syofficial-entity')]
#[Title('Create SyOfficial Entity')]
#[Description(
    'Create an official entity — a ministry, governorate or similar directory entry — inside a category. '
    .'The id is a permanent slug you choose and cannot be changed later. Entities are appended to the end '
    .'of their own category, so creating one does not disturb other categories. Uploaded images are '
    .'centre-cropped to a 200x200 WebP; with no image the entry gets a placeholder.'
)]
#[IsDestructive]
class CreateSyOfficialEntityTool extends SyOfficialTool
{
    protected array $permissions = ['syofficial.create'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Permanent slug, lowercase words and dashes only, e.g. "gov-damascus". Cannot be changed later.')
                ->required(),

            'category_id' => $schema->string()
                ->description('Category to put this entity in. Get valid ids from list-syofficial-categories.')
                ->required(),

            'name' => $schema->string()->description('English name. Required.')->required(),

            'name_ar' => $schema->string()->description('Arabic name. Required.')->required(),

            'description' => $schema->string()->description('Optional English description.'),

            'description_ar' => $schema->string()->description('Optional Arabic description.'),

            'socials' => $schema->array()
                ->description('Optional profile links. Only http and https are kept; anything else is dropped.')
                ->items($schema->string()->max(2048)),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string|max:128|alpha_dash',
            'category_id' => 'required|string|max:64',
            'name' => 'required|string|max:255',
            'name_ar' => 'required|string|max:255',
            'description' => 'nullable|string',
            'description_ar' => 'nullable|string',
            'socials' => 'nullable|array',
            'socials.*' => 'nullable|string|max:2048',
            'is_active' => 'boolean',
        ]);

        return $this->attempt(function () use ($validated) {
            $entity = app(SyOfficialDirectoryService::class)->createEntity(
                $validated,
                $validated['socials'] ?? [],
            );

            return Response::structured([
                'created' => true,
                'entity' => app(SyOfficialPresenter::class)->entity($entity->fresh()),
            ]);
        });
    }
}
