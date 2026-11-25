<?php

namespace App\Mcp\Tools\GovApps;

use App\Services\GovApps\GovAppPresenter;
use App\Services\GovApps\GovAppService;
use App\Support\Agents\AgentContext;
use App\Support\Permissions\PermissionCatalogue;
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
    protected array $permissions = [PermissionCatalogue::GOVAPPS_EDIT];

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

            'icon_url' => $schema->string()->description('Optional remote HTTP(S) image URL to download, convert to a square WebP icon, and store on R2.'),

            'links' => $schema->object($this->linkProperties($schema))
                ->description('Replace the links object keyed by channel: {"official": "...", "android": "...", "apple": "..."}. Omit to leave existing links untouched; pass an empty object to clear every link. A plain list is refused.'),

            ...$this->guideProperties($schema),
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
            'icon_url' => 'sometimes|nullable|url|max:2048',
            'links' => 'sometimes|array',
            'links.*' => 'nullable|string|max:2048',
            'official_entity_id' => 'sometimes|nullable|string|max:128|exists:official_entities,id',
            'overview_ar' => 'sometimes|nullable|string|max:10000',
            'features' => 'sometimes|nullable|array|max:20',
            'features.*' => 'nullable|string|max:500',
            'requirements' => 'sometimes|nullable|array|max:20',
            'requirements.*' => 'nullable|string|max:500',
            'faqs' => 'sometimes|nullable|array|max:20',
            'faqs.*.q' => 'required_with:faqs|string|max:500',
            'faqs.*.a' => 'required_with:faqs|string|max:2000',
            'verified_at' => 'sometimes|nullable|date',
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
