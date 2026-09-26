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

/**
 * The inverse of delete-gov-app, and the only tool that can bring a soft-deleted
 * record back.
 *
 * Gated on BOTH govapps.delete and govapps.edit, and that is a deliberate
 * choice rather than an oversight. There is no dedicated "restore" capability in
 * the catalogue, and restore is the one operation that puts content back in
 * public view. Granting only delete would let an agent with delete rights
 * resurrect records; granting only edit would let it undo deletions it was
 * never allowed to make. Requiring both means an agent can only reverse an
 * action its operator already trusted it with in both directions.
 *
 * If operators would rather treat restore as a first-class capability, adding
 * one is a catalogue change and this becomes a single-permission gate.
 */
#[Name('restore-gov-app')]
#[Title('Restore Deleted Government App')]
#[Description(
    'Bring a soft-deleted government application back, so it reappears in the admin listing. It returns to '
    .'the visibility it had when deleted: an app that was inactive stays inactive, so use toggle-gov-app '
    .'afterwards if it should be public. Has no effect on an app that is not deleted.'
)]
#[IsDestructive]
#[IsIdempotent]
class RestoreGovAppTool extends GovAppsTool
{
    protected array $permissions = ['govapps.delete', 'govapps.edit'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Id of the soft-deleted app to restore.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => 'required|string|max:128',
        ]);

        return $this->attempt(function () use ($validated) {
            $app = app(GovAppService::class)->restore($validated['id']);

            return Response::structured([
                'restored' => true,
                'is_active' => $app->is_active,
                'app' => app(GovAppPresenter::class)->item($app),
                'note' => $app->is_active
                    ? 'The app is public again.'
                    : 'The app is restored but still inactive. Use toggle-gov-app to make it public.',
            ]);
        });
    }
}
