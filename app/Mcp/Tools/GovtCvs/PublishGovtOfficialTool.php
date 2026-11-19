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

#[Name('publish-govt-official')]
#[Title('Publish Govt Official')]
#[Description(
    'Publish a government official profile to the public directory (`/govtcvs/{slug}`). '
    .'Verify details with get-govt-official first. Use archive-govt-official to hide it reversibly.'
)]
#[IsDestructive]
#[IsIdempotent]
class PublishGovtOfficialTool extends GovtCvsTool
{
    protected array $permissions = [PermissionCatalogue::GOVTCVS_PUBLISH];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('UUID or slug of the official to publish. Required.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate(['id' => ['required', 'string']]);

        return $this->attempt(function () use ($validated) {
            $official = app(GovtOfficialEditor::class)->publish(
                $this->findOfficial((string) $validated['id'])
            );

            return Response::structured([
                'published' => true,
                'url' => url('/govtcvs/'.$official->slug),
                'official' => app(GovtCvPresenter::class)->adminDetail($official),
            ]);
        });
    }
}
