<?php

namespace App\Mcp\Tools\GovApps;

use App\Services\GovApps\GovAppPresenter;
use App\Services\GovApps\GovAppService;
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

#[Name('update-gov-app')]
#[Title('Update Government App')]
#[Description(
    'Edit a government application. Every argument is optional and only what you pass is changed — omitting '
    .'links leaves the existing ones intact rather than clearing them. This tool does not change the active '
    .'flag; use toggle-gov-app. The id and the image gallery cannot be changed here.'
)]
#[IsDestructive]
#[IsIdempotent]
class UpdateGovAppTool extends GovAppsTool
{
    protected array $permissions = ['govapps.edit'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Id of the app to update.')
                ->required(),

            'name' => $schema->string()->description('New English name.'),

            'name_ar' => $schema->string()->description('New Arabic name.'),

            'description' => $schema->string()->description('New English description. Pass null to clear it.'),

            'description_ar' => $schema->string()->description('New Arabic description. Pass null to clear it.'),

            'links' => $schema->array()
                ->description('Replace the link list. Omit to leave it alone; pass an empty array to clear every link.')
                ->items($schema->string()->max(2048)),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string|max:128',
            'name' => 'sometimes|string|max:255',
            'name_ar' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'description_ar' => 'nullable|string',
            'links' => 'sometimes|array',
            'links.*' => 'nullable|string|max:2048',
        ]);

        return $this->attempt(function () use ($validated) {
            $attributes = array_diff_key($validated, ['id' => null, 'links' => null]);

            $app = app(GovAppService::class)->update(
                $validated['id'],
                $attributes,
                // null means "not supplied", leaving the links alone. Only an
                // explicit array replaces them.
                $validated['links'] ?? null,
            );

            return Response::structured([
                'updated' => true,
                'app' => app(GovAppPresenter::class)->item($app->fresh()),
            ]);
        });
    }
}
