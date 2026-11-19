<?php

namespace App\Mcp\Tools\GovtCvs;

use App\Services\GovtCvs\GovtCvPresenter;
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

#[Name('delete-govt-evidence')]
#[Title('Delete Govt Evidence')]
#[Description(
    'Delete a sourced evidence link from a government official.'
)]
#[IsDestructive]
class DeleteGovtEvidenceTool extends GovtCvsTool
{
    protected array $permissions = [PermissionCatalogue::GOVTCVS_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'evidence_id' => $schema->string()
                ->description('UUID of the evidence link to delete (from get-govt-official). Required.')
                ->required(),

            'official_id' => $schema->string()
                ->description('Optional official UUID or slug to verify the evidence link belongs to this official.'),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'evidence_id' => ['required', 'string'],
            'official_id' => ['nullable', 'string'],
        ]);

        return $this->attempt(function () use ($validated) {
            $official = ! empty($validated['official_id']) ? $this->findOfficial((string) $validated['official_id']) : null;
            $evidence = $this->findEvidenceLink((string) $validated['evidence_id'], $official);
            $official ??= $evidence->official;

            app(GovtOfficialEditor::class)->deleteEvidenceLink($evidence);

            return Response::structured([
                'deleted' => true,
                'evidence_id' => $evidence->id,
                'official' => $official ? app(GovtCvPresenter::class)->adminDetail($official->fresh()) : null,
            ]);
        });
    }
}
