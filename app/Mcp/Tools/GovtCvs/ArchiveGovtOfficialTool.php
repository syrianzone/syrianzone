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
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('archive-govt-official')]
#[Title('Archive Govt Official')]
#[Description(
    'Archive a government official profile, removing it from the public directory without deleting its data or '
    .'tenure history. Prefer this over delete-govt-official for reversible takedown.'
)]
#[IsDestructive]
#[IsIdempotent]
class ArchiveGovtOfficialTool extends GovtCvsTool
{
    protected array $permissions = [PermissionCatalogue::GOVTCVS_PUBLISH];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('UUID or slug of the official to archive. Required.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate(['id' => ['required', 'string']]);

        return $this->attempt(function () use ($validated) {
            $official = app(GovtOfficialEditor::class)->archive(
                $this->findOfficial((string) $validated['id'])
            );

            return Response::structured([
                'archived' => true,
                'official' => app(GovtCvPresenter::class)->adminDetail($official),
            ]);
        });
    }
}
