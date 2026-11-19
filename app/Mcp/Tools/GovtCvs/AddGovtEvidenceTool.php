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

#[Name('add-govt-evidence')]
#[Title('Add Govt Evidence')]
#[Description(
    'Attach a sourced evidence link (decree, official CV card, handover mention, operational news, interview, '
    .'or external source) to a government official and optionally a specific tenure.'
)]
#[IsDestructive]
class AddGovtEvidenceTool extends GovtCvsTool
{
    protected array $permissions = [PermissionCatalogue::GOVTCVS_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'official_id' => $schema->string()
                ->description('UUID or slug of the official. Required.')
                ->required(),

            ...$this->evidenceFieldsSchema($schema),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $rules = app(GovtCvRules::class);
        $data = $request->validate([
            'official_id' => ['required', 'string'],
            ...$rules->evidenceLink(),
        ], $rules->messages());

        return $this->attempt(function () use ($data) {
            $official = $this->findOfficial((string) $data['official_id']);
            unset($data['official_id']);

            $evidence = app(GovtOfficialEditor::class)->saveEvidenceLink($official, null, $data);
            $presenter = app(GovtCvPresenter::class);

            return Response::structured([
                'added' => true,
                'evidence' => $presenter->evidenceItem($evidence),
                'official' => $presenter->adminDetail($official->fresh()),
            ]);
        });
    }
}
