<?php

namespace App\Mcp\Tools\GovtCvs;

use App\Services\GovtCvs\GovtCvPresenter;
use App\Services\GovtCvs\GovtCvRules;
use App\Services\GovtCvs\GovtCvVocabulary;
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

            'tenure_id' => $schema->string()
                ->description('Optional UUID of the tenure on this official that this evidence supports.'),

            'evidence_type' => $schema->string()
                ->description('Evidence type key (from get-govtcv-options). Required.')
                ->enum(GovtCvVocabulary::evidenceTypes())
                ->required(),

            'paperless_record_id' => $schema->integer()
                ->description('Optional Paperless archive record ID.')
                ->min(1),

            'paperless_channel_id' => $schema->string()
                ->description('Optional Paperless source channel ID.')
                ->max(100),

            'paperless_message_id' => $schema->integer()
                ->description('Optional Paperless message ID.')
                ->min(1),

            'chunk_type' => $schema->string()
                ->description('Optional Paperless chunk type.')
                ->max(24),

            'source_title_ar' => $schema->string()
                ->description('Source title in Arabic. Required. Max 255 characters.')
                ->max(255)
                ->required(),

            'source_channel_ar' => $schema->string()
                ->description('Optional publishing channel or outlet name in Arabic. Max 255 characters.')
                ->max(255),

            'source_url' => $schema->string()
                ->description('Optional source URL (http or https). Max 500 characters.')
                ->max(500),

            'published_date' => $schema->string()
                ->description('Optional publication date (YYYY-MM-DD).'),

            'excerpt_ar' => $schema->string()
                ->description('Optional Arabic quote or excerpt from the source. Max 5000 characters.')
                ->max(5000),
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
