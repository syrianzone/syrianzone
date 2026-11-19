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

#[Name('update-govt-official')]
#[Title('Update Govt Official')]
#[Description(
    'Partially update a government official profile with optimistic locking. Call get-govt-official first and pass '
    .'its current version; the update is refused if someone modified the official in the meantime. Only provided '
    .'fields are updated (note: passing aliases replaces the aliases list).'
)]
#[IsDestructive]
#[IsIdempotent]
class UpdateGovtOfficialTool extends GovtCvsTool
{
    protected array $permissions = [PermissionCatalogue::GOVTCVS_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('UUID or slug of the official to update. Required.')
                ->required(),

            'version' => $schema->integer()
                ->description('The official\'s current version as returned by get-govt-official. Required for optimistic locking.')
                ->min(1)
                ->required(),

            ...$this->officialFieldsSchema($schema, partial: true),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $request->validate(['id' => ['required', 'string']]);

        return $this->attempt(function () use ($request, $context) {
            $official = $this->findOfficial((string) $request->get('id'));

            $rules = app(GovtCvRules::class);
            $data = $request->validate([
                ...$rules->official($official, partial: true),
                'id' => ['required', 'string'],
                'version' => ['required', 'integer', 'min:1'],
            ], $rules->messages());

            unset($data['id']);

            $updated = app(GovtOfficialEditor::class)->saveOfficial($official, $data, $context->user);

            return Response::structured([
                'updated' => true,
                'official' => app(GovtCvPresenter::class)->adminDetail($updated),
            ]);
        });
    }
}
