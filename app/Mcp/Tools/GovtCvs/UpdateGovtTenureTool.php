<?php

namespace App\Mcp\Tools\GovtCvs;

use App\Services\GovtCvs\GovtCvPresenter;
use App\Services\GovtCvs\GovtCvRules;
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
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('update-govt-tenure')]
#[Title('Update Govt Tenure')]
#[Description(
    'Partially update an existing government tenure (e.g. close an active role with status="ended", ended_at, and '
    .'end_reason). Automatically recomputes the official\'s derived summary fields.'
)]
#[IsDestructive]
#[IsIdempotent]
class UpdateGovtTenureTool extends GovtCvsTool
{
    protected array $permissions = [PermissionCatalogue::GOVTCVS_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'tenure_id' => $schema->string()
                ->description('UUID of the tenure to update (from get-govt-official). Required.')
                ->required(),

            'official_id' => $schema->string()
                ->description('Optional official UUID or slug to verify the tenure belongs to this official.'),

            ...$this->tenureFieldsSchema($schema, partial: true),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $rules = app(GovtCvRules::class);
        $data = $request->validate([
            'tenure_id' => ['required', 'string'],
            'official_id' => ['nullable', 'string'],
            ...$rules->tenure(partial: true),
        ], $rules->messages());

        return $this->attempt(function () use ($data) {
            $official = ! empty($data['official_id']) ? $this->findOfficial((string) $data['official_id']) : null;
            $tenure = $this->findTenure((string) $data['tenure_id'], $official);
            $official ??= $tenure->official;

            unset($data['tenure_id'], $data['official_id']);

            $updated = app(GovtTenureTracker::class)->saveTenure($official, $tenure, $data);
            $presenter = app(GovtCvPresenter::class);

            return Response::structured([
                'updated' => true,
                'tenure' => $presenter->tenureItem($updated),
                'official' => $presenter->adminDetail($official->fresh()),
            ]);
        });
    }
}
