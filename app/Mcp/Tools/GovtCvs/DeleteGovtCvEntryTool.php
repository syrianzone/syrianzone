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

#[Name('delete-govt-cv-entry')]
#[Title('Delete Govt CV Entry')]
#[Description(
    'Delete a CV entry from a government official and recompute the official\'s cv_completeness.'
)]
#[IsDestructive]
class DeleteGovtCvEntryTool extends GovtCvsTool
{
    protected array $permissions = [PermissionCatalogue::GOVTCVS_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'entry_id' => $schema->string()
                ->description('UUID of the CV entry to delete (from get-govt-official). Required.')
                ->required(),

            'official_id' => $schema->string()
                ->description('Optional official UUID or slug to verify the CV entry belongs to this official.'),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'entry_id' => ['required', 'string'],
            'official_id' => ['nullable', 'string'],
        ]);

        return $this->attempt(function () use ($validated) {
            $official = ! empty($validated['official_id']) ? $this->findOfficial((string) $validated['official_id']) : null;
            $entry = $this->findCvEntry((string) $validated['entry_id'], $official);
            $official ??= $entry->official;

            app(GovtOfficialEditor::class)->deleteCvEntry($entry);

            return Response::structured([
                'deleted' => true,
                'entry_id' => $entry->id,
                'official' => $official ? app(GovtCvPresenter::class)->adminDetail($official->fresh()) : null,
            ]);
        });
    }
}
