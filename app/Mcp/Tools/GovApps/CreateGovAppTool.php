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

#[Name('create-gov-app')]
#[Title('Create Government App')]
#[Description(
    'Add a government application to the directory. The id is a permanent slug you choose, in lowercase '
    .'words and dashes, and it cannot be changed later. The app is appended to the end of the display order. '
    .'Its image gallery starts empty and is maintained outside this tool.'
)]
#[IsDestructive]
class CreateGovAppTool extends GovAppsTool
{
    protected array $permissions = ['govapps.create'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Permanent slug, lowercase words and dashes only, e.g. "services". Cannot be changed later.')
                ->required(),

            'name' => $schema->string()
                ->description('English name. Required.')
                ->required(),

            'name_ar' => $schema->string()
                ->description('Arabic name. Required.')
                ->required(),

            'description' => $schema->string()->description('Optional English description.'),

            'description_ar' => $schema->string()->description('Optional Arabic description.'),

            'links' => $schema->array()
                ->description('Optional store or official links. Only http and https are kept; anything else is dropped.')
                ->items($schema->string()->max(2048)),

            'is_active' => $schema->boolean()
                ->description('Defaults to true. Set false to add it hidden while you prepare it.')
                ->default(true),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string|max:128|alpha_dash',
            'name' => 'required|string|max:255',
            'name_ar' => 'required|string|max:255',
            'description' => 'nullable|string',
            'description_ar' => 'nullable|string',
            'links' => 'nullable|array',
            'links.*' => 'nullable|string|max:2048',
            'is_active' => 'boolean',
        ]);

        return $this->attempt(function () use ($validated) {
            $app = app(GovAppService::class)->create(
                $validated,
                $validated['links'] ?? [],
            );

            return Response::structured([
                'created' => true,
                'app' => app(GovAppPresenter::class)->item($app->fresh()),
            ]);
        });
    }
}
