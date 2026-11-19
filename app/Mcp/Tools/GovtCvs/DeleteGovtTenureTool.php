<?php

namespace App\Mcp\Tools\GovtCvs;

use App\Services\GovtCvs\GovtCvPresenter;
use App\Services\GovtCvs\GovtTenureTracker;
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

#[Name('delete-govt-tenure')]
#[Title('Delete Govt Tenure')]
#[Description(
    'Delete a government tenure record and recompute the official\'s summary fields. '
    .'To mark a tenure as finished rather than erasing history, use update-govt-tenure with status="ended".'
)]
#[IsDestructive]
class DeleteGovtTenureTool extends GovtCvsTool
{
    protected array $permissions = [PermissionCatalogue::GOVTCVS_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'tenure_id' => $schema->string()
                ->description('UUID of the tenure to delete. Required.')
                ->required(),

            'official_id' => $schema->string()
                ->description('Optional official UUID or slug to verify the tenure belongs to this official.'),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'tenure_id' => ['required', 'string'],
            'official_id' => ['nullable', 'string'],
        ]);

        return $this->attempt(function () use ($validated) {
            $official = ! empty($validated['official_id']) ? $this->findOfficial((string) $validated['official_id']) : null;
            $tenure = $this->findTenure((string) $validated['tenure_id'], $official);
            $official ??= $tenure->official;

            app(GovtTenureTracker::class)->deleteTenure($tenure);

            return Response::structured([
                'deleted' => true,
                'tenure_id' => $tenure->id,
                'official' => $official ? app(GovtCvPresenter::class)->adminDetail($official->fresh()) : null,
            ]);
        });
    }
}
