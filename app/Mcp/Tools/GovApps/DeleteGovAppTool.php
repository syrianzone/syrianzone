<?php

namespace App\Mcp\Tools\GovApps;

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

#[Name('delete-gov-app')]
#[Title('Delete Government App')]
#[Description(
    'Delete a government application from the directory. This is a soft delete: the row is kept and the id '
    .'stays taken, so the app can be brought back with restore-gov-app, but it disappears from the admin '
    .'listing and the public site immediately. There is no permanent-purge tool.'
)]
#[IsDestructive]
class DeleteGovAppTool extends GovAppsTool
{
    protected array $permissions = ['govapps.delete'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Id of the app to delete.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string|max:128',
        ]);

        return $this->attempt(function () use ($validated) {
            $app = app(GovAppService::class)->delete($validated['id']);

            return Response::structured([
                'deleted' => true,
                'id' => $app->id,
                'recoverable' => true,
                'note' => 'This was a soft delete. Use restore-gov-app with this id to bring the app back.',
            ]);
        });
    }
}
