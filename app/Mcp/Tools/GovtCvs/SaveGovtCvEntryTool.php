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

#[Name('save-govt-cv-entry')]
#[Title('Save Govt CV Entry')]
#[Description(
    'Create or update a CV entry (education, career history, military/revolutionary, civic/social, certification, '
    .'or publication) on a government official. Omit entry_id to create a new entry (official_id, section, and '
    .'title_ar are required); pass entry_id to partially update an existing entry. Automatically recomputes cv_completeness.'
)]
#[IsDestructive]
class SaveGovtCvEntryTool extends GovtCvsTool
{
    protected array $permissions = [PermissionCatalogue::GOVTCVS_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'official_id' => $schema->string()
                ->description('UUID or slug of the official. Required when creating a new entry; optional when updating an existing entry_id.'),

            'entry_id' => $schema->string()
                ->description('Optional UUID of an existing CV entry to update (from get-govt-official). Omit to create a new entry.'),

            'section' => $schema->string()
                ->description('CV section key (from get-govtcv-options). Required when creating.')
                ->enum(GovtCvVocabulary::cvSections()),

            'title_ar' => $schema->string()
                ->description('Entry title in Arabic (e.g. degree, position, or certification). Required when creating. Max 255 characters.')
                ->max(255),

            'organization_ar' => $schema->string()
                ->description('Optional university, institution, or organization name in Arabic. Max 255 characters.')
                ->max(255),

            'location_ar' => $schema->string()
                ->description('Optional city or country in Arabic. Max 255 characters.')
                ->max(255),

            'start_year' => $schema->integer()
                ->description('Optional start year (1930-2100).')
                ->min(1930)
                ->max(2100),

            'end_year' => $schema->integer()
                ->description('Optional end year (1930-2100).')
                ->min(1930)
                ->max(2100),

            'is_ongoing' => $schema->boolean()
                ->description('Whether this entry is currently ongoing. Defaults to false.'),

            'details_ar' => $schema->string()
                ->description('Optional additional details in Arabic. Max 5000 characters.')
                ->max(5000),

            'sort_order' => $schema->integer()
                ->description('Optional 0-based display order within the official\'s CV entries.')
                ->min(0),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $isUpdate = filled($request->get('entry_id'));
        $rules = app(GovtCvRules::class);

        $data = $request->validate([
            'official_id' => [$isUpdate ? 'nullable' : 'required', 'string'],
            'entry_id' => ['nullable', 'string'],
            ...$rules->cvEntry(partial: $isUpdate),
        ], $rules->messages());

        return $this->attempt(function () use ($data, $isUpdate) {
            $official = ! empty($data['official_id']) ? $this->findOfficial((string) $data['official_id']) : null;
            $entry = $isUpdate ? $this->findCvEntry((string) $data['entry_id'], $official) : null;
            $official ??= $entry->official;

            unset($data['official_id'], $data['entry_id']);

            $saved = app(GovtOfficialEditor::class)->saveCvEntry($official, $entry, $data);
            $presenter = app(GovtCvPresenter::class);

            return Response::structured([
                $isUpdate ? 'updated' : 'created' => true,
                'cv_entry' => $presenter->cvEntryItem($saved),
                'official' => $presenter->adminDetail($official->fresh()),
            ]);
        });
    }
}
