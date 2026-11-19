<?php

namespace App\Services\GovtCvs;

use App\Models\Candidate;
use App\Models\GovtCvEntry;
use App\Models\GovtEvidenceLink;
use App\Models\GovtOfficeSlot;
use App\Models\GovtOfficial;
use App\Models\GovtOfficialAlias;
use App\Models\GovtTenure;
use App\Models\HouseMember2026;
use App\Models\OfficialEntity;
use App\Models\PromiseSpeaker;
use App\Services\Promises\SpeakerDirectory;
use App\Support\ArabicPersonName;
use App\Support\ArabicSearch;
use Illuminate\Support\Facades\DB;

/**
 * Idempotently imports researched Government CVs & Tenure Tracker data
 * (`database/seeders/data/govtcvs_research.json`) and cross-links officials to
 * `OfficialEntity`, `Candidate`, `PromiseSpeaker`, and `HouseMember2026`.
 */
final class GovtCvImportService
{
    public function __construct(private readonly GovtTenureTracker $tracker) {}

    /**
     * Import a decoded research JSON payload.
     *
     * Accepts either a top-level `{ office_slots: [...], officials: [...] }` map
     * or a plain list of official records `[...]`.
     *
     * @param  array<string, mixed>|array<int, array<string, mixed>>  $payload
     * @return array{slots_imported: int, officials_imported: int, tenures_imported: int, cv_entries_imported: int, evidence_imported: int, links_matched: int, rows: array<int, array{0: int, 1: string, 2: string}>}
     */
    public function import(array $payload, bool $dryRun = false): array
    {
        $slotsInput = [];
        $officialsInput = [];

        if (array_is_list($payload)) {
            $officialsInput = $payload;
        } else {
            $slotsInput = is_array($payload['office_slots'] ?? null) ? $payload['office_slots'] : [];
            $officialsInput = is_array($payload['officials'] ?? null) ? $payload['officials'] : [];
        }

        $stats = [
            'slots_imported' => 0,
            'officials_imported' => 0,
            'tenures_imported' => 0,
            'cv_entries_imported' => 0,
            'evidence_imported' => 0,
            'links_matched' => 0,
            'rows' => [],
        ];

        DB::beginTransaction();

        try {
            // 1. Pre-load existing institutions to avoid invalid FKs
            $knownInstitutions = OfficialEntity::query()->pluck('name_ar', 'id')->all();

            // 2. First pass on office_slots (upsert without replaced_by_slot_id)
            $slotsBySlug = [];
            foreach ($slotsInput as $slotData) {
                if (! is_array($slotData)) {
                    continue;
                }
                $slot = $this->upsertSlot($slotData, $knownInstitutions);
                if ($slot) {
                    $slotsBySlug[$slot->slug] = $slot;
                    $stats['slots_imported']++;
                }
            }

            // Second pass on office_slots to wire replaced_by_slot_slug / replaced_by_slot_id
            foreach ($slotsInput as $slotData) {
                if (! is_array($slotData)) {
                    continue;
                }
                $slug = trim((string) ($slotData['slug'] ?? ''));
                $replacedSlug = trim((string) ($slotData['replaced_by_slot_slug'] ?? $slotData['replaced_by_slug'] ?? ''));
                $replacedId = trim((string) ($slotData['replaced_by_slot_id'] ?? ''));

                $slot = $slotsBySlug[$slug] ?? ($slug !== '' ? GovtOfficeSlot::where('slug', $slug)->first() : null);
                if (! $slot) {
                    continue;
                }

                $target = null;
                if ($replacedId !== '') {
                    $target = GovtOfficeSlot::find($replacedId);
                } elseif ($replacedSlug !== '') {
                    $target = $slotsBySlug[$replacedSlug] ?? GovtOfficeSlot::where('slug', $replacedSlug)->first();
                }

                if ($target && $target->id !== $slot->id && $slot->replaced_by_slot_id !== $target->id) {
                    $slot->update(['replaced_by_slot_id' => $target->id]);
                }
            }

            // Refresh map of all slots by slug
            foreach (GovtOfficeSlot::all() as $s) {
                $slotsBySlug[$s->slug] = $s;
            }

            // 3. Upsert each official with aliases, tenures, cv_entries, and evidence_links
            foreach (array_values($officialsInput) as $idx => $item) {
                if (! is_array($item)) {
                    continue;
                }

                $fullNameAr = trim((string) ($item['full_name_ar'] ?? $item['name_ar'] ?? $item['display_name_ar'] ?? ''));
                if ($fullNameAr === '') {
                    $stats['rows'][] = [$idx + 1, '—', 'skipped: missing full_name_ar'];

                    continue;
                }

                $result = $this->upsertOfficial($item, $knownInstitutions, $slotsBySlug);
                $official = $result['official'];

                $stats['officials_imported']++;
                $stats['tenures_imported'] += $result['tenures'];
                $stats['cv_entries_imported'] += $result['cv_entries'];
                $stats['evidence_imported'] += $result['evidence'];

                $stats['rows'][] = [
                    $idx + 1,
                    $official->display_name_ar ?: $official->full_name_ar,
                    ($dryRun ? 'would upsert' : 'upserted')." ({$official->slug} · {$official->office_status} · {$result['tenures']} tenures)",
                ];
            }

            // 4. Cross-link officials to OfficialEntity, Candidate, PromiseSpeaker, and HouseMember2026
            $stats['links_matched'] = $this->autoLinkKnownRecords();

            if ($dryRun) {
                DB::rollBack();
            } else {
                DB::commit();
            }
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        return $stats;
    }

    /**
     * Upsert a single `GovtOfficeSlot` by `slug`.
     *
     * @param  array<string, mixed>  $data
     * @param  array<string, string>  $knownInstitutions
     */
    private function upsertSlot(array $data, array $knownInstitutions): ?GovtOfficeSlot
    {
        $titleAr = trim((string) ($data['title_ar'] ?? ''));
        if ($titleAr === '') {
            return null;
        }

        $slug = trim((string) ($data['slug'] ?? ''));
        if ($slug === '') {
            $slug = ArabicPersonName::slug($titleAr, 'slot');
        }

        [$instId, $instNameAr] = $this->resolveInstitution(
            $data['institution_id'] ?? null,
            $data['institution_name_ar'] ?? null,
            $knownInstitutions,
        );

        $tier = in_array($data['tier'] ?? '', GovtCvVocabulary::tiers(), true)
            ? (string) $data['tier']
            : 'minister';

        $status = in_array($data['status'] ?? '', GovtCvVocabulary::slotStatuses(), true)
            ? (string) $data['status']
            : 'active';

        return GovtOfficeSlot::updateOrCreate(
            ['slug' => $slug],
            [
                'title_ar' => $titleAr,
                'institution_id' => $instId,
                'institution_name_ar' => $instNameAr,
                'tier' => $tier,
                'is_single_seat' => array_key_exists('is_single_seat', $data) ? (bool) $data['is_single_seat'] : true,
                'status' => $status,
                'active_from' => $this->cleanDate($data['active_from'] ?? null),
                'ended_at' => $this->cleanDate($data['ended_at'] ?? null),
                'lineage_note_ar' => $data['lineage_note_ar'] ?? null,
            ],
        );
    }

    /**
     * Upsert a single `GovtOfficial` by `slug` along with aliases, tenures, CV entries, and evidence links.
     *
     * @param  array<string, mixed>  $data
     * @param  array<string, string>  $knownInstitutions
     * @param  array<string, GovtOfficeSlot>  $slotsBySlug
     * @return array{official: GovtOfficial, tenures: int, cv_entries: int, evidence: int}
     */
    private function upsertOfficial(array $data, array $knownInstitutions, array &$slotsBySlug): array
    {
        $fullNameAr = trim((string) ($data['full_name_ar'] ?? $data['name_ar'] ?? $data['display_name_ar']));
        $displayNameAr = trim((string) ($data['display_name_ar'] ?? ''));
        if ($displayNameAr === '') {
            $displayNameAr = ArabicPersonName::cleanName($fullNameAr) ?: $fullNameAr;
        }

        $fullNameEn = isset($data['full_name_en']) && trim((string) $data['full_name_en']) !== ''
            ? trim((string) $data['full_name_en'])
            : null;

        $honorificAr = isset($data['honorific_ar']) && trim((string) $data['honorific_ar']) !== ''
            ? trim((string) $data['honorific_ar'])
            : ArabicPersonName::extractHonorific($fullNameAr);

        $slug = trim((string) ($data['slug'] ?? ''));
        if ($slug === '') {
            $slug = ArabicPersonName::slug($fullNameEn ?: $displayNameAr ?: $fullNameAr, 'official');
        }

        $officeStatus = in_array($data['office_status'] ?? '', GovtCvVocabulary::officeStatuses(), true)
            ? (string) $data['office_status']
            : 'in_office';

        $highestTier = in_array($data['highest_tier'] ?? '', GovtCvVocabulary::tiers(), true)
            ? (string) $data['highest_tier']
            : 'minister';

        $cvCompleteness = in_array($data['cv_completeness'] ?? '', GovtCvVocabulary::cvCompleteness(), true)
            ? (string) $data['cv_completeness']
            : 'positions_only';

        $publishStatus = in_array($data['publish_status'] ?? '', GovtCvVocabulary::publishStatuses(), true)
            ? (string) $data['publish_status']
            : 'published';

        $verificationLevel = in_array($data['verification_level'] ?? '', GovtCvVocabulary::verificationLevels(), true)
            ? (string) $data['verification_level']
            : 'editorial';

        $existing = GovtOfficial::where('slug', $slug)->first();

        $attributes = [
            'full_name_ar' => $fullNameAr,
            'display_name_ar' => $displayNameAr,
            'full_name_en' => $fullNameEn ?? $existing?->full_name_en,
            'honorific_ar' => $honorificAr ?? $existing?->honorific_ar,
            'bio_summary_ar' => $data['bio_summary_ar'] ?? $existing?->bio_summary_ar,
            'office_status' => $officeStatus,
            'highest_tier' => $highestTier,
            'birth_year' => isset($data['birth_year']) ? (int) $data['birth_year'] : $existing?->birth_year,
            'birth_place_ar' => $data['birth_place_ar'] ?? $existing?->birth_place_ar,
            'gender' => $data['gender'] ?? $existing?->gender,
            'languages' => is_array($data['languages'] ?? null) ? $data['languages'] : $existing?->languages,
            'portrait_url' => $existing?->portrait_url ?: ($data['portrait_url'] ?? null),
            'cv_completeness' => $cvCompleteness,
            'first_seen_in_office_at' => $this->cleanDate($data['first_seen_in_office_at'] ?? null) ?? $existing?->first_seen_in_office_at?->format('Y-m-d'),
            'last_seen_in_office_at' => $this->cleanDate($data['last_seen_in_office_at'] ?? null) ?? $existing?->last_seen_in_office_at?->format('Y-m-d'),
            'publish_status' => $publishStatus,
            'verification_level' => $verificationLevel,
            'published_at' => $publishStatus === 'published' ? ($existing?->published_at ?? now()) : $existing?->published_at,
        ];

        // Safe explicit FK assignment if provided in JSON and not taken by another official
        $this->assignSafeExplicitLinks($attributes, $data, $existing?->id);

        if ($existing) {
            $existing->update($attributes);
            $official = $existing->fresh();
        } else {
            $official = GovtOfficial::create(['slug' => $slug, 'version' => 1] + $attributes);
        }

        // Sync / merge aliases
        if (is_array($data['aliases'] ?? null)) {
            $this->mergeAliases($official, $data['aliases']);
        }

        // Upsert tenures
        $tenuresByKey = [];
        $tenuresCount = 0;
        if (is_array($data['tenures'] ?? null)) {
            foreach ($data['tenures'] as $tIdx => $tData) {
                if (! is_array($tData)) {
                    continue;
                }
                $tenure = $this->upsertTenure($official, $tData, $knownInstitutions, $slotsBySlug);
                if ($tenure) {
                    $tenuresCount++;
                    $tenuresByKey[(string) $tIdx] = $tenure;
                    if (! empty($tData['office_slot_slug'])) {
                        $tenuresByKey[(string) $tData['office_slot_slug']] = $tenure;
                    }
                    if (! empty($tData['role_title_ar'])) {
                        $tenuresByKey[(string) $tData['role_title_ar']] = $tenure;
                    }

                    // Also import nested tenure evidence_links if present
                    if (is_array($tData['evidence_links'] ?? null)) {
                        foreach ($tData['evidence_links'] as $evData) {
                            if (is_array($evData)) {
                                $this->upsertEvidenceLink($official, $evData, $tenure->id);
                            }
                        }
                    }
                }
            }
        }

        // Upsert CV entries
        $cvCount = 0;
        if (is_array($data['cv_entries'] ?? null)) {
            foreach (array_values($data['cv_entries']) as $cIdx => $cData) {
                if (! is_array($cData)) {
                    continue;
                }
                if ($this->upsertCvEntry($official, $cData, $cIdx)) {
                    $cvCount++;
                }
            }
        }

        // Upsert top-level evidence links
        $evCount = 0;
        if (is_array($data['evidence_links'] ?? null)) {
            foreach ($data['evidence_links'] as $evData) {
                if (! is_array($evData)) {
                    continue;
                }

                $linkedTenureId = null;
                $tenureRef = $evData['tenure_slot_slug'] ?? $evData['office_slot_slug'] ?? $evData['tenure_role_title_ar'] ?? $evData['tenure_index'] ?? null;
                if ($tenureRef !== null && isset($tenuresByKey[(string) $tenureRef])) {
                    $linkedTenureId = $tenuresByKey[(string) $tenureRef]->id;
                } elseif (count($tenuresByKey) > 0 && empty($evData['tenure_id'])) {
                    $firstTenure = reset($tenuresByKey);
                    $linkedTenureId = $firstTenure ? $firstTenure->id : null;
                }

                if ($this->upsertEvidenceLink($official, $evData, $linkedTenureId)) {
                    $evCount++;
                }
            }
        }

        $official = $this->tracker->recomputeOfficialSummary($official);

        return [
            'official' => $official,
            'tenures' => $tenuresCount,
            'cv_entries' => $cvCount,
            'evidence' => $evCount,
        ];
    }

    /**
     * Merge aliases into `govt_official_aliases` without duplicates.
     *
     * @param  array<int, array<string, mixed>|string>  $aliases
     */
    private function mergeAliases(GovtOfficial $official, array $aliases): void
    {
        $existingFolds = $official->aliases()->pluck('alias_ar_fold')->filter()->flip()->all();

        foreach ($aliases as $item) {
            $aliasAr = is_string($item) ? trim($item) : trim((string) ($item['alias_ar'] ?? $item['alias'] ?? ''));
            if ($aliasAr === '') {
                continue;
            }

            $fold = ArabicSearch::fold($aliasAr);
            if ($fold === '' || isset($existingFolds[$fold])) {
                continue;
            }

            $aliasType = is_array($item) && in_array($item['alias_type'] ?? '', GovtCvVocabulary::aliasTypes(), true)
                ? (string) $item['alias_type']
                : 'patronymic_short';

            GovtOfficialAlias::create([
                'official_id' => $official->id,
                'alias_ar' => $aliasAr,
                'alias_type' => $aliasType,
                'source_note' => is_array($item) ? ($item['source_note'] ?? null) : null,
            ]);

            $existingFolds[$fold] = true;
        }
    }

    /**
     * Upsert a `GovtTenure` record for an official.
     *
     * @param  array<string, mixed>  $data
     * @param  array<string, string>  $knownInstitutions
     * @param  array<string, GovtOfficeSlot>  $slotsBySlug
     */
    private function upsertTenure(
        GovtOfficial $official,
        array $data,
        array $knownInstitutions,
        array &$slotsBySlug,
    ): ?GovtTenure {
        $slot = null;
        $slotSlug = trim((string) ($data['office_slot_slug'] ?? $data['slot_slug'] ?? ''));
        $slotId = trim((string) ($data['office_slot_id'] ?? ''));

        if ($slotId !== '') {
            $slot = GovtOfficeSlot::find($slotId);
        } elseif ($slotSlug !== '') {
            $slot = $slotsBySlug[$slotSlug] ?? GovtOfficeSlot::where('slug', $slotSlug)->first();
        }

        $roleTitleAr = trim((string) ($data['role_title_ar'] ?? $slot?->title_ar ?? ''));
        if ($roleTitleAr === '') {
            return null;
        }

        $tier = in_array($data['tier'] ?? '', GovtCvVocabulary::tiers(), true)
            ? (string) $data['tier']
            : ($slot?->tier ?? 'minister');

        [$instId, $instNameAr] = $this->resolveInstitution(
            $data['institution_id'] ?? $slot?->institution_id,
            $data['institution_name_ar'] ?? $slot?->institution_name_ar,
            $knownInstitutions,
        );

        // If slot slug was given in the tenure data but didn't exist in office_slots yet, auto-create the slot
        if (! $slot && $slotSlug !== '') {
            $slot = GovtOfficeSlot::firstOrCreate(
                ['slug' => $slotSlug],
                [
                    'title_ar' => $roleTitleAr,
                    'institution_id' => $instId,
                    'institution_name_ar' => $instNameAr,
                    'tier' => $tier,
                    'is_single_seat' => true,
                    'status' => 'active',
                ],
            );
            $slotsBySlug[$slot->slug] = $slot;
        }

        $startedAt = $this->cleanDate($data['started_at'] ?? null);
        $endedAt = $this->cleanDate($data['ended_at'] ?? null);

        $status = in_array($data['status'] ?? '', GovtCvVocabulary::tenureStatuses(), true)
            ? (string) $data['status']
            : ($endedAt ? 'ended' : 'current');

        $phase = in_array($data['government_phase'] ?? '', GovtCvVocabulary::governmentPhases(), true)
            ? (string) $data['government_phase']
            : 'transitional_2025';

        $startPrecision = in_array($data['start_date_precision'] ?? '', GovtCvVocabulary::datePrecisions(), true)
            ? (string) $data['start_date_precision']
            : 'exact';

        $endPrecision = in_array($data['end_date_precision'] ?? '', GovtCvVocabulary::datePrecisions(), true)
            ? (string) $data['end_date_precision']
            : null;

        $endReason = in_array($data['end_reason'] ?? '', GovtCvVocabulary::endReasons(), true)
            ? (string) $data['end_reason']
            : null;

        // Match existing tenure by (official_id, office_slot_id, started_at) or (official_id, role_title_ar, started_at)
        $existingQuery = GovtTenure::query()->where('official_id', $official->id);
        if ($slot) {
            $existingQuery->where('office_slot_id', $slot->id);
        } else {
            $existingQuery->where('role_title_ar', $roleTitleAr);
        }

        if ($startedAt !== null) {
            $existingQuery->where(function ($q) use ($startedAt) {
                $q->whereDate('started_at', $startedAt)->orWhereNull('started_at');
            });
        }

        $existing = $existingQuery->first();

        $attributes = [
            'official_id' => $official->id,
            'office_slot_id' => $slot?->id,
            'institution_id' => $instId,
            'institution_name_ar' => $instNameAr,
            'role_title_ar' => $roleTitleAr,
            'tier' => $tier,
            'government_phase' => $phase,
            'status' => $status,
            'started_at' => $startedAt,
            'start_date_precision' => $startPrecision,
            'start_decree_ref' => $data['start_decree_ref'] ?? null,
            'ended_at' => $endedAt,
            'end_date_precision' => $endPrecision,
            'end_reason' => $endReason,
            'end_decree_ref' => $data['end_decree_ref'] ?? null,
            'first_operational_seen_at' => $this->cleanDate($data['first_operational_seen_at'] ?? null),
            'last_operational_seen_at' => $this->cleanDate($data['last_operational_seen_at'] ?? null),
            'operational_mentions_count' => (int) ($data['operational_mentions_count'] ?? 0),
            'is_acting' => (bool) ($data['is_acting'] ?? false),
            'notes_ar' => $data['notes_ar'] ?? null,
        ];

        if ($existing) {
            $existing->update($attributes);

            return $existing->fresh();
        }

        return GovtTenure::create($attributes);
    }

    /**
     * Upsert a `GovtCvEntry` record for an official.
     *
     * @param  array<string, mixed>  $data
     */
    private function upsertCvEntry(GovtOfficial $official, array $data, int $defaultOrder): ?GovtCvEntry
    {
        $titleAr = trim((string) ($data['title_ar'] ?? ''));
        if ($titleAr === '') {
            return null;
        }

        $section = in_array($data['section'] ?? '', GovtCvVocabulary::cvSections(), true)
            ? (string) $data['section']
            : 'career_history';

        $organizationAr = isset($data['organization_ar']) && trim((string) $data['organization_ar']) !== ''
            ? trim((string) $data['organization_ar'])
            : null;

        return GovtCvEntry::updateOrCreate(
            [
                'official_id' => $official->id,
                'section' => $section,
                'title_ar' => $titleAr,
                'organization_ar' => $organizationAr,
            ],
            [
                'location_ar' => $data['location_ar'] ?? null,
                'start_year' => isset($data['start_year']) && $data['start_year'] !== '' ? (int) $data['start_year'] : null,
                'end_year' => isset($data['end_year']) && $data['end_year'] !== '' ? (int) $data['end_year'] : null,
                'is_ongoing' => (bool) ($data['is_ongoing'] ?? false),
                'details_ar' => $data['details_ar'] ?? null,
                'sort_order' => isset($data['sort_order']) ? (int) $data['sort_order'] : $defaultOrder,
            ],
        );
    }

    /**
     * Upsert a `GovtEvidenceLink` record for an official.
     *
     * @param  array<string, mixed>  $data
     */
    private function upsertEvidenceLink(GovtOfficial $official, array $data, ?string $defaultTenureId = null): ?GovtEvidenceLink
    {
        $sourceTitleAr = trim((string) ($data['source_title_ar'] ?? $data['title_ar'] ?? ''));
        if ($sourceTitleAr === '') {
            return null;
        }

        $evidenceType = in_array($data['evidence_type'] ?? '', GovtCvVocabulary::evidenceTypes(), true)
            ? (string) $data['evidence_type']
            : 'operational_mention';

        $recordId = isset($data['paperless_record_id']) && $data['paperless_record_id'] !== ''
            ? (int) $data['paperless_record_id']
            : null;

        $tenureId = $data['tenure_id'] ?? $defaultTenureId;
        if ($tenureId !== null && ! GovtTenure::whereKey($tenureId)->where('official_id', $official->id)->exists()) {
            $tenureId = $defaultTenureId;
        }

        $match = ['official_id' => $official->id, 'evidence_type' => $evidenceType];
        if ($recordId !== null) {
            $match['paperless_record_id'] = $recordId;
        } else {
            $match['source_title_ar'] = $sourceTitleAr;
            $match['published_date'] = $this->cleanDate($data['published_date'] ?? null);
        }

        return GovtEvidenceLink::updateOrCreate(
            $match,
            [
                'tenure_id' => $tenureId,
                'paperless_record_id' => $recordId,
                'paperless_channel_id' => $data['paperless_channel_id'] ?? null,
                'paperless_message_id' => isset($data['paperless_message_id']) && $data['paperless_message_id'] !== ''
                    ? (int) $data['paperless_message_id']
                    : null,
                'chunk_type' => $data['chunk_type'] ?? null,
                'source_title_ar' => $sourceTitleAr,
                'source_channel_ar' => $data['source_channel_ar'] ?? null,
                'source_url' => $data['source_url'] ?? null,
                'published_date' => $this->cleanDate($data['published_date'] ?? null),
                'excerpt_ar' => $data['excerpt_ar'] ?? null,
            ],
        );
    }

    /**
     * Automatically link `GovtOfficial` records to matching `OfficialEntity` (`ministers`/`public_figures`),
     * `Candidate`, `PromiseSpeaker`, and `HouseMember2026` using `ArabicPersonName::namesMatch()`,
     * never failing if a unique foreign key is already claimed by another official.
     */
    public function autoLinkKnownRecords(): int
    {
        $officials = GovtOfficial::with('aliases')->get();
        if ($officials->isEmpty()) {
            return 0;
        }

        $entities = OfficialEntity::query()
            ->whereIn('category_id', SpeakerDirectory::PEOPLE_CATEGORIES)
            ->get(['id', 'name', 'name_ar']);

        $candidates = Candidate::query()->get(['id', 'name']);
        $speakers = PromiseSpeaker::query()->where('status', '!=', 'rejected')->get(['id', 'name', 'candidate_id', 'official_entity_id', 'house_member_id']);
        $houseMembers = HouseMember2026::query()->get(['id', 'name_ar']);

        $validEntityIds = OfficialEntity::query()->pluck('id')->flip()->all();
        $validCandidateIds = $candidates->pluck('id')->flip()->all();
        $validHouseIds = $houseMembers->pluck('id')->flip()->all();

        $takenEntities = GovtOfficial::whereNotNull('official_entity_id')->pluck('id', 'official_entity_id')->all();
        $takenCandidates = GovtOfficial::whereNotNull('candidate_id')->pluck('id', 'candidate_id')->all();
        $takenSpeakers = GovtOfficial::whereNotNull('promise_speaker_id')->pluck('id', 'promise_speaker_id')->all();
        $takenHouse = GovtOfficial::whereNotNull('house_member_id')->pluck('id', 'house_member_id')->all();

        $linksMatched = 0;

        foreach ($officials as $official) {
            $names = array_values(array_unique(array_filter([
                $official->display_name_ar,
                $official->full_name_ar,
                ...$official->aliases->pluck('alias_ar')->all(),
            ])));

            $updates = [];

            // 1. OfficialEntity (ministers / public_figures) — Arabic name match first, then normalized English name
            if ($official->official_entity_id === null) {
                $matchedEntity = $this->findUnambiguousMatch(
                    $entities,
                    $names,
                    fn (OfficialEntity $e) => (string) ($e->name_ar ?: $e->name),
                    fn (OfficialEntity $e) => ! isset($takenEntities[$e->id]),
                );

                if (! $matchedEntity && filled($official->full_name_en)) {
                    $normOfficialEn = $this->normalizeEnglishName((string) $official->full_name_en);
                    if (strlen($normOfficialEn) >= 6) {
                        $enMatches = $entities->filter(function (OfficialEntity $e) use ($normOfficialEn, $takenEntities): bool {
                            if (isset($takenEntities[$e->id]) || ! filled($e->name)) {
                                return false;
                            }

                            return $this->normalizeEnglishName((string) $e->name) === $normOfficialEn;
                        })->values();

                        if ($enMatches->count() === 1) {
                            $matchedEntity = $enMatches->first();
                        }
                    }
                }

                if ($matchedEntity) {
                    $updates['official_entity_id'] = $matchedEntity->id;
                    $takenEntities[$matchedEntity->id] = $official->id;
                }
            }

            // 2. Candidate
            if ($official->candidate_id === null) {
                $matchedCandidate = $this->findUnambiguousMatch(
                    $candidates,
                    $names,
                    fn (Candidate $c) => (string) $c->name,
                    fn (Candidate $c) => ! isset($takenCandidates[$c->id]),
                );
                if ($matchedCandidate) {
                    $updates['candidate_id'] = $matchedCandidate->id;
                    $takenCandidates[$matchedCandidate->id] = $official->id;
                }
            }

            // 3. HouseMember2026 (exact normalized full-name match only to prevent patronymic collisions)
            if ($official->house_member_id === null) {
                $matchedHouse = $this->findUnambiguousMatch(
                    $houseMembers,
                    $names,
                    fn (HouseMember2026 $m) => (string) $m->name_ar,
                    fn (HouseMember2026 $m) => ! isset($takenHouse[$m->id]),
                    allowFuzzy: false,
                );
                if ($matchedHouse) {
                    $updates['house_member_id'] = (int) $matchedHouse->id;
                    $takenHouse[$matchedHouse->id] = $official->id;
                }
            }

            // 4. PromiseSpeaker (by shared candidate_id/official_entity_id/house_member_id first, then name match)
            $matchedSpeaker = null;
            if ($official->promise_speaker_id !== null) {
                $matchedSpeaker = $speakers->firstWhere('id', $official->promise_speaker_id);
            } else {
                $candId = $updates['candidate_id'] ?? $official->candidate_id;
                $entId = $updates['official_entity_id'] ?? $official->official_entity_id;
                $houseId = $updates['house_member_id'] ?? $official->house_member_id;

                if ($candId) {
                    $matchedSpeaker = $speakers->first(fn (PromiseSpeaker $s) => $s->candidate_id === $candId && ! isset($takenSpeakers[$s->id]));
                }
                if (! $matchedSpeaker && $entId) {
                    $matchedSpeaker = $speakers->first(fn (PromiseSpeaker $s) => $s->official_entity_id === $entId && ! isset($takenSpeakers[$s->id]));
                }
                if (! $matchedSpeaker && $houseId) {
                    $matchedSpeaker = $speakers->first(fn (PromiseSpeaker $s) => $s->house_member_id === (int) $houseId && ! isset($takenSpeakers[$s->id]));
                }
                if (! $matchedSpeaker) {
                    $matchedSpeaker = $this->findUnambiguousMatch(
                        $speakers,
                        $names,
                        fn (PromiseSpeaker $s) => (string) $s->name,
                        fn (PromiseSpeaker $s) => ! isset($takenSpeakers[$s->id]),
                    );
                }

                if ($matchedSpeaker) {
                    $updates['promise_speaker_id'] = $matchedSpeaker->id;
                    $takenSpeakers[$matchedSpeaker->id] = $official->id;
                }
            }

            // 5. Propagate FKs from matched PromiseSpeaker back onto GovtOfficial when available and unclaimed
            if ($matchedSpeaker) {
                $currentEntId = $updates['official_entity_id'] ?? $official->official_entity_id;
                if ($currentEntId === null
                    && filled($matchedSpeaker->official_entity_id)
                    && isset($validEntityIds[$matchedSpeaker->official_entity_id])
                    && ! isset($takenEntities[$matchedSpeaker->official_entity_id])) {
                    $updates['official_entity_id'] = $matchedSpeaker->official_entity_id;
                    $takenEntities[$matchedSpeaker->official_entity_id] = $official->id;
                }

                $currentCandId = $updates['candidate_id'] ?? $official->candidate_id;
                if ($currentCandId === null
                    && filled($matchedSpeaker->candidate_id)
                    && isset($validCandidateIds[$matchedSpeaker->candidate_id])
                    && ! isset($takenCandidates[$matchedSpeaker->candidate_id])) {
                    $updates['candidate_id'] = $matchedSpeaker->candidate_id;
                    $takenCandidates[$matchedSpeaker->candidate_id] = $official->id;
                }

                $currentHouseId = $updates['house_member_id'] ?? $official->house_member_id;
                if ($currentHouseId === null
                    && $matchedSpeaker->house_member_id !== null
                    && isset($validHouseIds[(int) $matchedSpeaker->house_member_id])
                    && ! isset($takenHouse[(int) $matchedSpeaker->house_member_id])) {
                    $updates['house_member_id'] = (int) $matchedSpeaker->house_member_id;
                    $takenHouse[(int) $matchedSpeaker->house_member_id] = $official->id;
                }
            }

            if ($updates !== []) {
                $official->update($updates);
                $linksMatched += count($updates);
            }
        }

        return $linksMatched;
    }

    /**
     * Normalize an English person name by stripping common honorific prefixes, parentheticals,
     * and non-ASCII-letter characters into a lowercase comparison key.
     */
    private function normalizeEnglishName(string $name): string
    {
        $name = preg_replace('/\([^)]*\)/', ' ', $name) ?? $name;
        $name = preg_replace('/\b(dr|mr|mrs|ms|prof|eng|col|colonel|gen|general|sheikh|judge|ambassador|em)\.?\b/i', ' ', $name) ?? $name;

        return strtolower(preg_replace('/[^a-z]+/i', '', $name) ?? '');
    }

    /**
     * Find a single unambiguous matching record from `$pool` against `$officialNames`.
     * Prefers exact normalized name equality before falling back to `ArabicPersonName::namesMatch()`.
     *
     * @template TModel
     *
     * @param  iterable<TModel>  $pool
     * @param  array<int, string>  $officialNames
     * @param  callable(TModel): string  $getName
     * @param  callable(TModel): bool  $isAvailable
     * @return TModel|null
     */
    private function findUnambiguousMatch(iterable $pool, array $officialNames, callable $getName, callable $isAvailable, bool $allowFuzzy = true): mixed
    {
        $normalizedNeedles = array_values(array_filter(array_map(
            fn (string $n) => ArabicPersonName::normalizeName($n),
            $officialNames,
        ), fn (string $n) => mb_strlen($n) >= ArabicPersonName::MIN_MATCH_LENGTH));

        if ($normalizedNeedles === []) {
            return null;
        }

        $exactMatches = [];
        $fuzzyMatches = [];

        foreach ($pool as $record) {
            if (! $isAvailable($record)) {
                continue;
            }

            $targetName = $getName($record);
            $normTarget = ArabicPersonName::normalizeName($targetName);
            if (mb_strlen($normTarget) < ArabicPersonName::MIN_MATCH_LENGTH) {
                continue;
            }

            if (in_array($normTarget, $normalizedNeedles, true)) {
                $exactMatches[] = $record;

                continue;
            }

            if (! $allowFuzzy) {
                continue;
            }

            foreach ($officialNames as $name) {
                if (ArabicPersonName::namesMatch($targetName, $name)) {
                    $fuzzyMatches[] = $record;
                    break;
                }
            }
        }

        if (count($exactMatches) === 1) {
            return $exactMatches[0];
        }

        if ($allowFuzzy && $exactMatches === [] && count($fuzzyMatches) === 1) {
            return $fuzzyMatches[0];
        }

        return null;
    }

    /**
     * Resolve `institution_id` against existing `official_entities`, setting `institution_id = null`
     * while preserving `institution_name_ar` if the ID does not exist in `official_entities`.
     *
     * @param  array<string, string>  $knownInstitutions
     * @return array{0: string|null, 1: string|null}
     */
    private function resolveInstitution(mixed $rawId, mixed $rawNameAr, array $knownInstitutions): array
    {
        $id = is_string($rawId) && trim($rawId) !== '' ? trim($rawId) : null;
        $nameAr = is_string($rawNameAr) && trim($rawNameAr) !== '' ? trim($rawNameAr) : null;

        if ($id !== null && isset($knownInstitutions[$id])) {
            return [$id, $nameAr ?: $knownInstitutions[$id]];
        }

        // Try matching by exact Arabic name if institution_id wasn't found
        if ($nameAr !== null) {
            $foldTarget = ArabicSearch::fold($nameAr);
            foreach ($knownInstitutions as $knownId => $knownName) {
                if ($knownName === $nameAr || ArabicSearch::fold((string) $knownName) === $foldTarget) {
                    return [$knownId, $nameAr];
                }
            }
        }

        return [null, $nameAr];
    }

    /**
     * Assign explicit foreign keys from JSON only when they exist in target tables
     * and are not already claimed by another official.
     *
     * @param  array<string, mixed>  $attributes
     * @param  array<string, mixed>  $data
     */
    private function assignSafeExplicitLinks(array &$attributes, array $data, ?string $ignoreOfficialId): void
    {
        if (! empty($data['official_entity_id']) && is_string($data['official_entity_id'])) {
            $entId = trim($data['official_entity_id']);
            if (OfficialEntity::whereKey($entId)->exists()
                && ! GovtOfficial::where('official_entity_id', $entId)->when($ignoreOfficialId, fn ($q) => $q->whereKeyNot($ignoreOfficialId))->exists()) {
                $attributes['official_entity_id'] = $entId;
            }
        }

        if (! empty($data['candidate_id']) && is_string($data['candidate_id'])) {
            $candId = trim($data['candidate_id']);
            if (Candidate::whereKey($candId)->exists()
                && ! GovtOfficial::where('candidate_id', $candId)->when($ignoreOfficialId, fn ($q) => $q->whereKeyNot($ignoreOfficialId))->exists()) {
                $attributes['candidate_id'] = $candId;
            }
        }

        if (! empty($data['promise_speaker_id']) && is_string($data['promise_speaker_id'])) {
            $spkId = trim($data['promise_speaker_id']);
            if (PromiseSpeaker::whereKey($spkId)->exists()
                && ! GovtOfficial::where('promise_speaker_id', $spkId)->when($ignoreOfficialId, fn ($q) => $q->whereKeyNot($ignoreOfficialId))->exists()) {
                $attributes['promise_speaker_id'] = $spkId;
            }
        }

        if (! empty($data['house_member_id'])) {
            $hmId = (int) $data['house_member_id'];
            if (HouseMember2026::whereKey($hmId)->exists()
                && ! GovtOfficial::where('house_member_id', $hmId)->when($ignoreOfficialId, fn ($q) => $q->whereKeyNot($ignoreOfficialId))->exists()) {
                $attributes['house_member_id'] = $hmId;
            }
        }
    }

    private function cleanDate(mixed $date): ?string
    {
        if (! is_string($date)) {
            return null;
        }
        $trimmed = trim($date);
        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $trimmed, $m)) {
            return $m[0];
        }

        return null;
    }
}
