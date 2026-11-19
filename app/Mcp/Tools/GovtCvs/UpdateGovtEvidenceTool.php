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
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('update-govt-evidence')]
#[Title('Update Govt Evidence')]
#[Description(
    'Partially update an existing sourced evidence link on a government official (e.g. fix source_url, '
    .'source_title_ar, source_channel_ar, published_date, excerpt_ar, evidence_type, or linked tenure_id).'
)]
#[IsDestructive]
#[IsIdempotent]
class UpdateGovtEvidenceTool extends GovtCvsTool
{
    protected array $permissions = [PermissionCatalogue::GOVTCVS_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'evidence_id' => $schema->string()
                ->description('UUID of the evidence link to update (from get-govt-official). Required.')
                ->required(),

            'official_id' => $schema->string()
                ->description('Optional official UUID or slug to verify the evidence link belongs to this official.'),

            ...$this->evidenceFieldsSchema($schema, partial: true),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $rules = app(GovtCvRules::class);
        $data = $request->validate([
            'evidence_id' => ['required', 'string'],
            'official_id' => ['nullable', 'string'],
            ...$rules->evidenceLink(partial: true),
        ], $rules->messages());

        return $this->attempt(function () use ($data) {
            $official = ! empty($data['official_id']) ? $this->findOfficial((string) $data['official_id']) : null;
            $evidence = $this->findEvidenceLink((string) $data['evidence_id'], $official);
            $official ??= $evidence->official;

            unset($data['evidence_id'], $data['official_id']);

            $updated = app(GovtOfficialEditor::class)->saveEvidenceLink($official, $evidence, $data);
            $presenter = app(GovtCvPresenter::class);

            return Response::structured([
                'updated' => true,
                'evidence' => $presenter->evidenceItem($updated),
                'official' => $presenter->adminDetail($official->fresh()),
            ]);
        });
    }
}
