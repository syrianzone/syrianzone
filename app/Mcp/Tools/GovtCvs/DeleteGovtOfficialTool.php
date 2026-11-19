<?php

namespace App\Mcp\Tools\GovtCvs;

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

#[Name('delete-govt-official')]
#[Title('Delete Govt Official')]
#[Description(
    'Permanently delete a government official profile and its tenures, CV entries, aliases, and evidence links. '
    .'There is no undo. To remove an official from public view reversibly, use archive-govt-official instead.'
)]
#[IsDestructive]
class DeleteGovtOfficialTool extends GovtCvsTool
{
    protected array $permissions = [PermissionCatalogue::GOVTCVS_DELETE];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('UUID or slug of the official to delete. Required.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate(['id' => ['required', 'string']]);

        return $this->attempt(function () use ($validated) {
            $official = $this->findOfficial((string) $validated['id']);
            app(GovtOfficialEditor::class)->deleteOfficial($official);

            return Response::structured([
                'deleted' => true,
                'id' => $official->id,
                'slug' => $official->slug,
            ]);
        });
    }
}
