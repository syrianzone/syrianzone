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

#[Name('toggle-gov-app')]
#[Title('Show or Hide Government App')]
#[Description(
    'Set a government application active or inactive. Hiding removes it from the public directory while '
    .'keeping the record and its position, so this is the reversible alternative to deleting.'
)]
#[IsDestructive]
#[IsIdempotent]
class ToggleGovAppTool extends GovAppsTool
{
    protected array $permissions = ['govapps.toggle'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Id of the app to show or hide.')
                ->required(),

            'is_active' => $schema->boolean()
                ->description('True to show it publicly, false to hide it.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string|max:128',
            'is_active' => 'required|boolean',
        ]);

        return $this->attempt(function () use ($validated) {
            $app = app(GovAppService::class)->setActive(
                $validated['id'],
                (bool) $validated['is_active'],
            );

            return Response::structured([
                'is_active' => $app->is_active,
                'app' => app(GovAppPresenter::class)->item($app->fresh()),
            ]);
        });
    }
}
