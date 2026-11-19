<?php

namespace App\Mcp\Tools\GovtCvs;

use App\Exceptions\GovtCvActionException;
use App\Mcp\Tools\AuditedTool;
use App\Models\GovtCvEntry;
use App\Models\GovtOfficeSlot;
use App\Models\GovtOfficial;
use App\Models\GovtTenure;
use App\Services\GovtCvs\GovtCvVocabulary;
use App\Services\GovtCvs\GovtOfficialEditor;
use App\Services\GovtCvs\GovtTenureTracker;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

/**
 * Shared base for Government CVs (`السير الذاتية للمسؤولين`) MCP tools.
 */
abstract class GovtCvsTool extends AuditedTool
{
    protected const READ_PERMISSIONS = [
        PermissionCatalogue::GOVTCVS_VIEW,
        PermissionCatalogue::GOVTCVS_CREATE,
        PermissionCatalogue::GOVTCVS_EDIT,
        PermissionCatalogue::GOVTCVS_PUBLISH,
        PermissionCatalogue::GOVTCVS_SLOTS,
        PermissionCatalogue::GOVTCVS_DELETE,
    ];

    /**
     * @param  callable(): (Response|ResponseFactory)  $callback
     */
    protected function attempt(callable $callback): Response|ResponseFactory
    {
        try {
            return $callback();
        } catch (GovtCvActionException $e) {
            return Response::error(match ($e->kind) {
                GovtCvActionException::NOT_FOUND => sprintf('%s %s', $e->getMessage(), $this->notFoundHint()),
                GovtCvActionException::STALE => sprintf(
                    '%s The official changed after you read it (it is now at version %d). Call get-govt-official again, apply your change to the fresh values, and retry with the new version.',
                    $e->getMessage(),
                    $e->context['version'] ?? 0,
                ),
                GovtCvActionException::SLUG_TAKEN => sprintf(
                    '%s Choose a different slug or omit slug to auto-generate a unique one.',
                    $e->getMessage(),
                ),
                GovtCvActionException::SLOT_IN_USE => sprintf(
                    '%s Reassign or delete the linked tenures before deleting this office slot.',
                    $e->getMessage(),
                ),
                GovtCvActionException::DATE_OUT_OF_ORDER => sprintf(
                    '%s Ensure ended_at is on or after started_at.',
                    $e->getMessage(),
                ),
                default => $e->getMessage(),
            });
        }
    }

    /** Where the agent finds valid ids or slugs when the one it passed does not exist. */
    protected function notFoundHint(): string
    {
        return 'Call list-govt-officials to find valid official ids or slugs.';
    }

    protected function findOfficial(string $idOrSlug): GovtOfficial
    {
        return app(GovtOfficialEditor::class)->findOfficial($idOrSlug);
    }

    protected function findTenure(string $id, ?GovtOfficial $official = null): GovtTenure
    {
        return app(GovtTenureTracker::class)->findTenure($id, $official);
    }

    protected function findCvEntry(string $id, ?GovtOfficial $official = null): GovtCvEntry
    {
        return app(GovtOfficialEditor::class)->findCvEntry($id, $official);
    }

    protected function findSlot(string $id): GovtOfficeSlot
    {
        return app(GovtTenureTracker::class)->findSlot($id);
    }

    /**
     * Shared field schema for create-govt-official and update-govt-official.
     *
     * @return array<string, mixed>
     */
    protected function officialFieldsSchema(JsonSchema $schema, bool $partial = false): array
    {
        $fullNameAr = $schema->string()
            ->description('Official full name in Arabic (e.g. "أحمد الشرع" or "د. مظهر الويس"). Max 255 characters.')
            ->max(255);

        if (! $partial) {
            $fullNameAr->required();
        }

        return [
            'slug' => $schema->string()
                ->description('Optional URL slug (lowercase alphanumeric and hyphens, max 160). Auto-generated if omitted.')
                ->max(160),

            'full_name_ar' => $fullNameAr,

            'display_name_ar' => $schema->string()
                ->description('Optional clean display name in Arabic without honorifics. Derived from full_name_ar if omitted. Max 255 characters.')
                ->max(255),

            'full_name_en' => $schema->string()
                ->description('Optional full name in English. Max 255 characters.')
                ->max(255),

            'honorific_ar' => $schema->string()
                ->description('Optional Arabic honorific or academic title (e.g. "د.", "المهندس", "اللواء"). Max 100 characters.')
                ->max(100),

            'bio_summary_ar' => $schema->string()
                ->description('Optional biographical summary in Arabic. Max 5000 characters.')
                ->max(5000),

            'office_status' => $schema->string()
                ->description('Current office status key (from get-govtcv-options). Defaults to "in_office" on creation; automatically recomputed when tenures are added.')
                ->enum(GovtCvVocabulary::officeStatuses()),

            'highest_tier' => $schema->string()
                ->description('Highest seniority tier key (from get-govtcv-options). Defaults to "minister" on creation; recomputed from tenures.')
                ->enum(GovtCvVocabulary::tiers()),

            'birth_year' => $schema->integer()
                ->description('Optional birth year (1920-2015).')
                ->min(1920)
                ->max(2015),

            'birth_place_ar' => $schema->string()
                ->description('Optional birthplace in Arabic (city/governorate). Max 255 characters.')
                ->max(255),

            'gender' => $schema->string()
                ->description('Optional gender.')
                ->enum(['male', 'female', 'M', 'F']),

            'languages' => $schema->array()
                ->description('Optional list of languages spoken (up to 15).')
                ->max(15)
                ->items($schema->string()->max(64)),

            'portrait_url' => $schema->string()
                ->description('Optional portrait URL (http/https, /storage/, or /images/ path). Max 500 characters.')
                ->max(500),

            'cv_completeness' => $schema->string()
                ->description('CV completeness level (from get-govtcv-options). Recomputed automatically from bio and CV entries.')
                ->enum(GovtCvVocabulary::cvCompleteness()),

            'first_seen_in_office_at' => $schema->string()
                ->description('Optional earliest observed date in office (YYYY-MM-DD).'),

            'last_seen_in_office_at' => $schema->string()
                ->description('Optional latest observed date in office (YYYY-MM-DD).'),

            'candidate_id' => $schema->string()
                ->description('Optional linked Tierlist Candidate ID (must be unique across officials).'),

            'promise_speaker_id' => $schema->string()
                ->description('Optional linked PromiseSpeaker UUID (must be unique across officials).'),

            'official_entity_id' => $schema->string()
                ->description('Optional linked OfficialEntity ID from SyOfficial (must be unique across officials).')
                ->max(255),

            'house_member_id' => $schema->integer()
                ->description('Optional linked HouseMember2026 ID (must be unique across officials).'),

            'publish_status' => $schema->string()
                ->description('Publication status ("draft", "published", "archived"). Defaults to "draft" on creation.')
                ->enum(GovtCvVocabulary::publishStatuses()),

            'verification_level' => $schema->string()
                ->description('Verification level key (from get-govtcv-options). Defaults to "editorial" on creation.')
                ->enum(GovtCvVocabulary::verificationLevels()),

            'aliases' => $schema->array()
                ->description('Optional alternative names/spellings for Arabic search (up to 25). When provided on update, replaces existing aliases.')
                ->max(25)
                ->items($schema->object([
                    'alias_ar' => $schema->string()
                        ->description('Alternative name in Arabic. Required.')
                        ->max(255)
                        ->required(),
                    'alias_type' => $schema->string()
                        ->description('Alias type key (from get-govtcv-options). Defaults to "patronymic_short".')
                        ->enum(GovtCvVocabulary::aliasTypes()),
                    'source_note' => $schema->string()
                        ->description('Optional note on where this alias appeared.')
                        ->max(255),
                ])),
        ];
    }

    /**
     * Shared field schema for add-govt-tenure and update-govt-tenure.
     *
     * @return array<string, mixed>
     */
    protected function tenureFieldsSchema(JsonSchema $schema, bool $partial = false): array
    {
        $roleTitle = $schema->string()
            ->description('Role title in Arabic (e.g. "وزير الطاقة", "محافظ حلب"). Max 255 characters.')
            ->max(255);

        $tier = $schema->string()
            ->description('Seniority tier key (from get-govtcv-options).')
            ->enum(GovtCvVocabulary::tiers());

        if (! $partial) {
            $roleTitle->required();
            $tier->required();
        }

        return [
            'office_slot_id' => $schema->string()
                ->description('Optional UUID of the govt_office_slots record (from list-govt-slots or get-govtcv-options).'),

            'institution_id' => $schema->string()
                ->description('Optional institution ID from get-govtcv-options.')
                ->max(255),

            'institution_name_ar' => $schema->string()
                ->description('Optional institution name in Arabic if not resolved from institution_id or office_slot_id. Max 255 characters.')
                ->max(255),

            'role_title_ar' => $roleTitle,

            'tier' => $tier,

            'government_phase' => $schema->string()
                ->description('Government phase key (from get-govtcv-options). Defaults to "transitional_2025".')
                ->enum(GovtCvVocabulary::governmentPhases()),

            'status' => $schema->string()
                ->description('Tenure status ("current", "ended", "uncertain"). Defaults to "current" (or "ended" if ended_at is given).')
                ->enum(GovtCvVocabulary::tenureStatuses()),

            'started_at' => $schema->string()
                ->description('Tenure start date (YYYY-MM-DD).'),

            'start_date_precision' => $schema->string()
                ->description('Precision of started_at (from get-govtcv-options). Defaults to "exact".')
                ->enum(GovtCvVocabulary::datePrecisions()),

            'start_decree_ref' => $schema->string()
                ->description('Optional appointment decree or decision reference (e.g. "مرسوم رقم 14 لعام 2025"). Max 160 characters.')
                ->max(160),

            'ended_at' => $schema->string()
                ->description('Tenure end date (YYYY-MM-DD). Must be on or after started_at. Ignored if status is "current".'),

            'end_date_precision' => $schema->string()
                ->description('Precision of ended_at (from get-govtcv-options).')
                ->enum(GovtCvVocabulary::datePrecisions()),

            'end_reason' => $schema->string()
                ->description('Reason the tenure ended (from get-govtcv-options).')
                ->enum(GovtCvVocabulary::endReasons()),

            'end_decree_ref' => $schema->string()
                ->description('Optional end/dismissal decree reference. Max 160 characters.')
                ->max(160),

            'first_operational_seen_at' => $schema->string()
                ->description('Optional first date the official was operationally seen in this role (YYYY-MM-DD).'),

            'last_operational_seen_at' => $schema->string()
                ->description('Optional last date the official was operationally seen in this role (YYYY-MM-DD).'),

            'operational_mentions_count' => $schema->integer()
                ->description('Count of operational mentions supporting this tenure.')
                ->min(0),

            'is_acting' => $schema->boolean()
                ->description('Whether the official served in an acting/caretaker capacity. Defaults to false.'),

            'notes_ar' => $schema->string()
                ->description('Optional Arabic notes about this tenure. Max 5000 characters.')
                ->max(5000),

            'auto_close_incumbent' => $schema->boolean()
                ->description('When true (default) and office_slot_id is a single-seat slot with status="current", automatically closes any prior current incumbent on that slot.'),
        ];
    }
}
