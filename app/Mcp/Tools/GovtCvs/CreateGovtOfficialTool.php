<?php

namespace App\Mcp\Tools\GovtCvs;

use App\Services\GovtCvs\GovtCvPresenter;
use App\Services\GovtCvs\GovtCvRules;
use App\Services\GovtCvs\GovtOfficialEditor;
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

#[Name('create-govt-official')]
#[Title('Create Govt Official')]
#[Description(
    'Create a new government official profile (defaults to publish_status="draft"). Call get-govtcv-options first '
    .'for valid tiers, statuses, and cross-module entity links. Use add-govt-tenure, save-govt-cv-entry, and '
    .'add-govt-evidence afterwards to populate positions, CV entries, and citations.'
)]
#[IsDestructive]
class CreateGovtOfficialTool extends GovtCvsTool
{
    protected array $permissions = [PermissionCatalogue::GOVTCVS_CREATE];

    public function schema(JsonSchema $schema): array
    {
        return $this->officialFieldsSchema($schema, partial: false);
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $rules = app(GovtCvRules::class);
        $data = $request->validate($rules->official(), $rules->messages());

        return $this->attempt(function () use ($data, $context) {
            $official = app(GovtOfficialEditor::class)->saveOfficial(null, $data, $context->user);

            return Response::structured([
                'created' => true,
                'official' => app(GovtCvPresenter::class)->adminDetail($official),
            ]);
        });
    }
}
