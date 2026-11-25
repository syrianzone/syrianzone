<?php

namespace App\Services\GovtCvs;

use App\Models\GovtCvEntry;
use App\Models\GovtEvidenceLink;
use App\Models\GovtOfficeSlot;
use App\Models\GovtOfficial;
use App\Models\GovtOfficialAlias;
use App\Models\GovtTenure;
use App\Models\Promise;
use Illuminate\Support\Collection;

/**
 * Consistent array serialization for Government CVs (`السير الذاتية للمسؤولين`)
 * across public Inertia pages, public JSON API, admin Inertia pages, admin JSON API,
 * and MCP tools.
 */
final class GovtCvPresenter
{
    public const PUBLIC_LIST_WITH = [
        'tenures.institution',
        'candidate',
        'promiseSpeaker.candidate',
        'promiseSpeaker.officialEntity',
        'officialEntity',
    ];

    public const PUBLIC_CARD_WITH = [
        'tenures.institution',
        'tenures.officeSlot',
        'candidate',
        'promiseSpeaker.candidate',
        'promiseSpeaker.officialEntity',
        'officialEntity',
        'houseMember',
    ];

    public const PUBLIC_DETAIL_WITH = [
        ...self::PUBLIC_CARD_WITH,
        'aliases',
        'cvEntries',
        'evidenceLinks',
        'tenures.evidenceLinks',
        'tenures.officeSlot.replacedBy',
    ];

    /**
     * Lean public summary card for `/govtcvs`, containing only the fields
     * read by `OfficialCard`, client-side filters, and sorting.
     *
     * @return array<string, mixed>
     */
    public function publicListCard(GovtOfficial $official): array
    {
        $official->loadMissing(self::PUBLIC_LIST_WITH);

        $tenures = $official->tenures;
        $activeTenure = $tenures->firstWhere('status', 'current') ?? $tenures->first();
        $displayName = $official->display_name_ar ?: $official->full_name_ar;

        $card = [
            'id' => $official->id,
            'slug' => $official->slug,
            'full_name_ar' => $official->full_name_ar,
            'office_status' => $official->office_status,
            'highest_tier' => $official->highest_tier,
            'cv_completeness' => $official->cv_completeness,
            'tenures_count' => $official->tenures_count !== null ? (int) $official->tenures_count : $tenures->count(),
        ];

        if ($displayName !== $official->full_name_ar) {
            $card['display_name_ar'] = $displayName;
        }
        if (filled($official->full_name_en)) {
            $card['full_name_en'] = $official->full_name_en;
        }
        if (filled($official->honorific_ar)) {
            $card['honorific_ar'] = $official->honorific_ar;
        }
        if (filled($official->bio_summary_ar)) {
            $card['bio_summary_ar'] = $official->bio_summary_ar;
        }
        if (filled($official->birth_place_ar)) {
            $card['birth_place_ar'] = $official->birth_place_ar;
        }
        if ($portrait = $official->resolvedPortrait()) {
            $card['portrait_url'] = $portrait;
        }
        if ($official->first_seen_in_office_at !== null) {
            $card['first_seen_in_office_at'] = $official->first_seen_in_office_at->format('Y-m-d');
        }
        if ($activeTenure !== null) {
            $card['active_tenure'] = $this->activeTenureBrief($activeTenure);
        }

        return $card;
    }

    /**
     * Lean active-tenure payload for the public `/govtcvs` index.
     *
     * @return array<string, mixed>
     */
    public function activeTenureBrief(GovtTenure $tenure): array
    {
        $institutionName = $tenure->institution?->name_ar
            ?: $tenure->institution?->name
            ?: $tenure->institution_name_ar;

        $brief = [
            'role_title_ar' => $tenure->role_title_ar,
            'tier' => $tenure->tier,
            'government_phase' => $tenure->government_phase,
        ];

        if ($tenure->institution_id !== null) {
            $brief['institution_id'] = $tenure->institution_id;
        }
        if (filled($institutionName)) {
            $brief['institution_name_ar'] = $institutionName;
        }
        if ($tenure->started_at !== null) {
            $brief['started_at'] = $tenure->started_at->format('Y-m-d');
            if ($tenure->start_date_precision !== null) {
                $brief['start_date_precision'] = $tenure->start_date_precision;
            }
        }
        if ($tenure->ended_at !== null) {
            $brief['ended_at'] = $tenure->ended_at->format('Y-m-d');
            if ($tenure->end_date_precision !== null) {
                $brief['end_date_precision'] = $tenure->end_date_precision;
            }
        }
        if ($tenure->is_acting) {
            $brief['is_acting'] = true;
        }

        return $brief;
    }

    /**
     * Public summary card for an official on `/govtcvs`.
     *
     * @return array<string, mixed>
     */
    public function publicCard(GovtOfficial $official): array
    {
        $official->loadMissing(self::PUBLIC_CARD_WITH);

        $tenures = $official->tenures;
        $activeCurrentTenure = $tenures->firstWhere('status', 'current');
        $currentTenure = $activeCurrentTenure ?? $tenures->first();
        $institutionName = $currentTenure
            ? ($currentTenure->institution?->name_ar ?: $currentTenure->institution?->name ?: $currentTenure->institution_name_ar)
            : null;
        $resolvedPortrait = $official->resolvedPortrait();

        return [
            'id' => $official->id,
            'slug' => $official->slug,
            'full_name_ar' => $official->full_name_ar,
            'display_name_ar' => $official->display_name_ar ?: $official->full_name_ar,
            'full_name_en' => $official->full_name_en,
            'honorific_ar' => $official->honorific_ar,
            'bio_summary_ar' => $official->bio_summary_ar,
            'office_status' => $official->office_status,
            'office_status_label' => GovtCvVocabulary::label('office_statuses', $official->office_status),
            'highest_tier' => $official->highest_tier,
            'highest_tier_label' => GovtCvVocabulary::label('tiers', $official->highest_tier),
            'cv_completeness' => $official->cv_completeness,
            'cv_completeness_label' => GovtCvVocabulary::label('cv_completeness', $official->cv_completeness),
            'verification_level' => $official->verification_level,
            'verification_level_label' => GovtCvVocabulary::label('verification_levels', $official->verification_level),
            'publish_status' => $official->publish_status,
            'portrait_url' => $resolvedPortrait,
            'resolved_portrait_url' => $resolvedPortrait,
            'birth_year' => $official->birth_year,
            'birth_place_ar' => $official->birth_place_ar,
            'gender' => $official->gender,
            'first_seen_in_office_at' => $official->first_seen_in_office_at?->format('Y-m-d'),
            'last_seen_in_office_at' => $official->last_seen_in_office_at?->format('Y-m-d'),
            'primary_role_title_ar' => $currentTenure?->role_title_ar,
            'primary_institution_id' => $currentTenure?->institution_id,
            'primary_institution_name_ar' => $institutionName,
            'primary_government_phase' => $currentTenure?->government_phase,
            'tenures_count' => $official->tenures_count !== null ? (int) $official->tenures_count : $tenures->count(),
            'cv_entries_count' => (int) ($official->cv_entries_count ?? ($official->relationLoaded('cvEntries') ? $official->cvEntries->count() : 0)),
            'evidence_count' => (int) ($official->evidence_links_count ?? ($official->relationLoaded('evidenceLinks') ? $official->evidenceLinks->count() : 0)),
            'current_tenure' => $activeCurrentTenure ? $this->tenureBrief($activeCurrentTenure) : null,
            'current_tenures' => $tenures
                ->where('status', 'current')
                ->values()
                ->map(fn (GovtTenure $t) => $this->tenureBrief($t))
                ->all(),
            'latest_tenure' => $currentTenure ? $this->tenureBrief($currentTenure) : null,
            'has_promises' => $official->promise_speaker_id !== null,
            'has_tierlist' => $official->candidate_id !== null || $official->official_entity_id !== null,
            'version' => (int) $official->version,
            'updated_at' => $official->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Full public detail payload for `/govtcvs/{slug}`.
     *
     * @return array<string, mixed>
     */
    public function publicDetail(GovtOfficial $official): array
    {
        $official->loadMissing(self::PUBLIC_DETAIL_WITH);

        $slotNeighbors = $this->resolveSlotLineage($official->tenures, publishedOnly: true);

        $tenures = $official->tenures
            ->map(fn (GovtTenure $t) => $this->tenureItem($t, $slotNeighbors[$t->id] ?? ['predecessor' => null, 'successor' => null]))
            ->values()
            ->all();

        $cvEntries = $official->cvEntries
            ->map(fn (GovtCvEntry $e) => $this->cvEntryItem($e))
            ->values()
            ->all();

        $cvBySection = [];
        foreach (GovtCvVocabulary::list('cv_sections') as $sectionMeta) {
            $key = (string) $sectionMeta['key'];
            $items = array_values(array_filter($cvEntries, fn (array $e) => $e['section'] === $key));
            if ($items !== []) {
                $cvBySection[] = [
                    'section' => $key,
                    'label' => $sectionMeta['label'],
                    'glyph' => $sectionMeta['glyph'] ?? null,
                    'entries' => $items,
                ];
            }
        }

        $displayName = $official->display_name_ar ?: $official->full_name_ar;
        $candidateName = $official->candidate?->name ?: ($official->officialEntity?->name_ar ?: $displayName);
        $entityNameAr = $official->officialEntity
            ? ($official->officialEntity->name_ar ?: $official->officialEntity->name ?: $displayName)
            : null;
        $houseMemberName = $official->houseMember?->name_ar ?: $displayName;

        $hasTierlist = $official->candidate_id !== null || $official->official_entity_id !== null;
        $syofficialHref = $official->official_entity_id && $entityNameAr !== null
            ? '/syofficial?q='.urlencode($entityNameAr)
            : null;

        return $this->publicCard($official) + [
            'languages' => $official->languages ?? [],
            'socials' => $official->resolvedSocials(),
            'aliases' => $official->aliases->map(fn (GovtOfficialAlias $a) => $this->aliasItem($a))->values()->all(),
            'tenures' => $tenures,
            'cv_entries' => $cvEntries,
            'cv_sections' => $cvBySection,
            'evidence_links' => $official->evidenceLinks
                ->map(fn (GovtEvidenceLink $e) => $this->evidenceItem($e))
                ->values()
                ->all(),
            'links' => [
                'candidate_id' => $official->candidate_id,
                'promise_speaker_id' => $official->promise_speaker_id,
                'official_entity_id' => $official->official_entity_id,
                'house_member_id' => $official->house_member_id,
                'tierlist_url' => $hasTierlist ? '/tierlist' : null,
                'promises_url' => $official->promise_speaker_id ? '/promises' : null,
                'syofficial_url' => $syofficialHref,
                'house_url' => $official->house_member_id ? '/house' : null,
            ],
            'related_promises' => $this->relatedPromises($official),
            'tierlist_link' => $hasTierlist ? [
                'candidate_id' => $official->candidate_id,
                'official_entity_id' => $official->official_entity_id,
                'name' => $candidateName,
                'title' => $official->candidate?->title ?? $official->officialEntity?->description_ar,
                'status' => $official->candidate?->status,
                'url' => '/tierlist',
                'href' => '/tierlist',
                'label' => 'ملف '.$candidateName.' في تقييم الحكومة (تير ليست)',
            ] : null,
            'official_entity_link' => ($official->official_entity_id && $entityNameAr !== null) ? [
                'href' => $syofficialHref,
                'label' => 'الحسابات الرسمية الموثّقة ('.$entityNameAr.')',
                'entity_id' => $official->official_entity_id,
            ] : null,
            'house_link' => $official->house_member_id ? [
                'href' => '/house',
                'label' => 'عضو في مجلس الشعب 2026',
                'member_name' => $houseMemberName,
                'house_member_id' => (int) $official->house_member_id,
            ] : null,
            'published_at' => $official->published_at?->toIso8601String(),
        ];
    }

    /**
     * Admin table row for an official.
     *
     * @return array<string, mixed>
     */
    public function adminRow(GovtOfficial $official): array
    {
        $official->loadMissing([
            'tenures.institution',
            'tenures.officeSlot',
            'candidate',
            'promiseSpeaker',
            'officialEntity',
            'houseMember',
        ]);

        $activeCurrentTenure = $official->tenures->firstWhere('status', 'current');
        $primaryTenure = $activeCurrentTenure ?? $official->tenures->first();
        $institutionName = $primaryTenure
            ? ($primaryTenure->institution?->name_ar ?: $primaryTenure->institution?->name ?: $primaryTenure->institution_name_ar)
            : null;
        $resolvedPortrait = $official->resolvedPortrait();

        return [
            'id' => $official->id,
            'slug' => $official->slug,
            'full_name_ar' => $official->full_name_ar,
            'display_name_ar' => $official->display_name_ar ?: $official->full_name_ar,
            'full_name_en' => $official->full_name_en,
            'honorific_ar' => $official->honorific_ar,
            'office_status' => $official->office_status,
            'office_status_label' => GovtCvVocabulary::label('office_statuses', $official->office_status),
            'highest_tier' => $official->highest_tier,
            'highest_tier_label' => GovtCvVocabulary::label('tiers', $official->highest_tier),
            'cv_completeness' => $official->cv_completeness,
            'cv_completeness_label' => GovtCvVocabulary::label('cv_completeness', $official->cv_completeness),
            'publish_status' => $official->publish_status,
            'publish_status_label' => GovtCvVocabulary::label('publish_statuses', $official->publish_status),
            'verification_level' => $official->verification_level,
            'verification_level_label' => GovtCvVocabulary::label('verification_levels', $official->verification_level),
            'portrait_url' => $resolvedPortrait,
            'resolved_portrait_url' => $resolvedPortrait,
            'raw_portrait_url' => $official->portrait_url,
            'primary_role_title_ar' => $primaryTenure?->role_title_ar,
            'primary_institution_id' => $primaryTenure?->institution_id,
            'primary_institution_name_ar' => $institutionName,
            'current_tenure' => $activeCurrentTenure ? $this->tenureBrief($activeCurrentTenure) : null,
            'latest_tenure' => $primaryTenure ? $this->tenureBrief($primaryTenure) : null,
            'first_seen_in_office_at' => $official->first_seen_in_office_at?->format('Y-m-d'),
            'last_seen_in_office_at' => $official->last_seen_in_office_at?->format('Y-m-d'),
            'tenures_count' => (int) ($official->tenures_count ?? $official->tenures->count()),
            'cv_entries_count' => (int) ($official->cv_entries_count ?? 0),
            'evidence_links_count' => (int) ($official->evidence_links_count ?? 0),
            'evidence_count' => (int) ($official->evidence_links_count ?? 0),
            'aliases_count' => (int) ($official->aliases_count ?? 0),
            'candidate_id' => $official->candidate_id,
            'promise_speaker_id' => $official->promise_speaker_id,
            'official_entity_id' => $official->official_entity_id,
            'house_member_id' => $official->house_member_id,
            'version' => (int) $official->version,
            'published_at' => $official->published_at?->toIso8601String(),
            'updated_at' => $official->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Full admin editor payload for an official.
     *
     * @return array<string, mixed>
     */
    public function adminDetail(GovtOfficial $official): array
    {
        $official->loadMissing(self::PUBLIC_DETAIL_WITH);

        $slotNeighbors = $this->resolveSlotLineage($official->tenures, publishedOnly: false);

        return $this->publicDetail($official) + [
            'raw_portrait_url' => $official->portrait_url,
            'publish_status' => $official->publish_status,
            'publish_status_label' => GovtCvVocabulary::label('publish_statuses', $official->publish_status),
            'candidate_id' => $official->candidate_id,
            'promise_speaker_id' => $official->promise_speaker_id,
            'official_entity_id' => $official->official_entity_id,
            'house_member_id' => $official->house_member_id,
            'version' => (int) $official->version,
            'tenures' => $official->tenures
                ->map(fn (GovtTenure $t) => $this->tenureItem($t, $slotNeighbors[$t->id] ?? ['predecessor' => null, 'successor' => null]))
                ->values()
                ->all(),
        ];
    }

    /**
     * A chronological movement item (appointment or departure/end of tenure)
     * for `/govtcvs/movements`.
     *
     * @return array<string, mixed>
     */
    public function movementItem(GovtTenure $tenure, ?string $eventKind = null, ?array $lineage = null, bool $compact = false): array
    {
        $tenure->loadMissing(['official.candidate', 'official.officialEntity', 'official.promiseSpeaker', 'institution', 'officeSlot', 'evidenceLinks']);

        if ($lineage === null) {
            $map = $this->resolveSlotLineage(collect([$tenure]), publishedOnly: true);
            $lineage = $map[$tenure->id] ?? ['predecessor' => null, 'successor' => null];
        }

        $kind = $eventKind ?? ($tenure->status === 'ended' && $tenure->ended_at !== null ? 'ended' : 'appointed');
        $eventDate = $kind === 'ended'
            ? ($tenure->ended_at?->format('Y-m-d') ?? $tenure->last_operational_seen_at?->format('Y-m-d'))
            : ($tenure->started_at?->format('Y-m-d') ?? $tenure->first_operational_seen_at?->format('Y-m-d'));
        $eventPrecision = $kind === 'ended' ? $tenure->end_date_precision : $tenure->start_date_precision;
        $decreeRef = $kind === 'ended' ? $tenure->end_decree_ref : $tenure->start_decree_ref;

        $predecessor = $lineage['predecessor'] ?? null;
        $successor = $lineage['successor'] ?? null;

        if ($kind === 'ended') {
            $movementKind = (in_array($tenure->end_reason, ['reassigned', 'promoted', 'replaced'], true) || $successor !== null)
                ? 'transition'
                : 'exit';
        } else {
            $movementKind = $predecessor !== null ? 'transition' : 'appointment';
        }

        $institutionName = $tenure->institution?->name_ar
            ?: $tenure->institution?->name
            ?: $tenure->institution_name_ar;

        $official = $tenure->official;
        $officialName = $official ? ($official->display_name_ar ?: $official->full_name_ar) : '';
        $officialPortrait = $official?->resolvedPortrait();
        $sourceUrl = $tenure->evidenceLinks->first(fn (GovtEvidenceLink $e) => filled($e->source_url))?->source_url;

        if ($compact) {
            return [
                'id' => $tenure->id.':'.$kind,
                'tenure_id' => $tenure->id,
                'movement_kind' => $movementKind,
                'date' => $eventDate,
                'date_precision' => $eventPrecision,
                'decree_ref' => $decreeRef,
                'end_reason' => $tenure->end_reason,
                'role_title_ar' => $tenure->role_title_ar,
                'tier' => $tenure->tier,
                'government_phase' => $tenure->government_phase,
                'institution_id' => $tenure->institution_id,
                'institution_name_ar' => $institutionName,
                'official_slug' => $official?->slug ?? '',
                'official_name_ar' => $officialName,
                'official_honorific_ar' => $official?->honorific_ar,
                'official_portrait_url' => $officialPortrait,
                'official_office_status' => $official?->office_status ?? 'uncertain',
                'source_url' => $sourceUrl,
                'predecessor' => $predecessor ? [
                    'official_slug' => $predecessor['official_slug'],
                    'official_name_ar' => $predecessor['official_name_ar'],
                ] : null,
                'successor' => $successor ? [
                    'official_slug' => $successor['official_slug'],
                    'official_name_ar' => $successor['official_name_ar'],
                ] : null,
            ];
        }

        return [
            'id' => $tenure->id.':'.$kind,
            'tenure_id' => $tenure->id,
            'event_kind' => $kind,
            'movement_kind' => $movementKind,
            'event_date' => $eventDate,
            'date' => $eventDate,
            'event_precision' => $eventPrecision,
            'date_precision' => $eventPrecision,
            'decree_ref' => $decreeRef,
            'end_reason' => $tenure->end_reason,
            'end_reason_label' => GovtCvVocabulary::label('end_reasons', $tenure->end_reason),
            'role_title_ar' => $tenure->role_title_ar,
            'tier' => $tenure->tier,
            'tier_label' => GovtCvVocabulary::label('tiers', $tenure->tier),
            'government_phase' => $tenure->government_phase,
            'government_phase_label' => GovtCvVocabulary::label('government_phases', $tenure->government_phase),
            'status' => $tenure->status,
            'status_label' => GovtCvVocabulary::label('tenure_statuses', $tenure->status),
            'is_acting' => (bool) $tenure->is_acting,
            'started_at' => $tenure->started_at?->format('Y-m-d'),
            'ended_at' => $tenure->ended_at?->format('Y-m-d'),
            'institution_id' => $tenure->institution_id,
            'institution_name_ar' => $institutionName,
            'office_slot_id' => $tenure->office_slot_id,
            'office_slot_slug' => $tenure->officeSlot?->slug,
            'office_slot_title_ar' => $tenure->officeSlot?->title_ar,
            'notes_ar' => $tenure->notes_ar,
            'official_slug' => $official?->slug ?? '',
            'official_name_ar' => $officialName,
            'official_honorific_ar' => $official?->honorific_ar,
            'official_portrait_url' => $officialPortrait,
            'official_office_status' => $official?->office_status ?? 'uncertain',
            'source_url' => $sourceUrl,
            'official' => $official ? [
                'id' => $official->id,
                'slug' => $official->slug,
                'full_name_ar' => $official->full_name_ar,
                'display_name_ar' => $officialName,
                'honorific_ar' => $official->honorific_ar,
                'office_status' => $official->office_status,
                'portrait_url' => $officialPortrait,
            ] : null,
            'predecessor' => $predecessor,
            'successor' => $successor,
        ];
    }

    /**
     * An office slot serialized with its tenure holders.
     *
     * @return array<string, mixed>
     */
    public function slotItem(GovtOfficeSlot $slot): array
    {
        $slot->loadMissing(['institution', 'replacedBy', 'tenures.official']);

        $holders = $slot->tenures
            ->map(function (GovtTenure $t): array {
                $name = $t->official?->display_name_ar ?: $t->official?->full_name_ar;

                return [
                    'id' => $t->official_id,
                    'slug' => $t->official?->slug,
                    'display_name_ar' => $name,
                    'tenure_id' => $t->id,
                    'official_id' => $t->official_id,
                    'official_slug' => $t->official?->slug,
                    'official_name_ar' => $name,
                    'role_title_ar' => $t->role_title_ar,
                    'status' => $t->status,
                    'started_at' => $t->started_at?->format('Y-m-d'),
                    'ended_at' => $t->ended_at?->format('Y-m-d'),
                    'end_reason' => $t->end_reason,
                    'is_acting' => (bool) $t->is_acting,
                ];
            })
            ->values()
            ->all();

        $currentHolder = collect($holders)->firstWhere('status', 'current');

        return [
            'id' => $slot->id,
            'slug' => $slot->slug,
            'title_ar' => $slot->title_ar,
            'institution_id' => $slot->institution_id,
            'institution_name_ar' => $slot->institution?->name_ar
                ?: $slot->institution?->name
                ?: $slot->institution_name_ar,
            'tier' => $slot->tier,
            'tier_label' => GovtCvVocabulary::label('tiers', $slot->tier),
            'is_single_seat' => (bool) $slot->is_single_seat,
            'status' => $slot->status,
            'status_label' => GovtCvVocabulary::label('slot_statuses', $slot->status),
            'active_from' => $slot->active_from?->format('Y-m-d'),
            'ended_at' => $slot->ended_at?->format('Y-m-d'),
            'lineage_note_ar' => $slot->lineage_note_ar,
            'replaced_by_slot_id' => $slot->replaced_by_slot_id,
            'replaced_by_slot' => $slot->replacedBy ? [
                'id' => $slot->replacedBy->id,
                'slug' => $slot->replacedBy->slug,
                'title_ar' => $slot->replacedBy->title_ar,
            ] : null,
            'tenures_count' => $slot->tenures_count !== null ? (int) $slot->tenures_count : count($holders),
            'current_holder' => $currentHolder,
            'holders' => $holders,
            'updated_at' => $slot->updated_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function tenureBrief(GovtTenure $tenure): array
    {
        $institutionName = $tenure->institution?->name_ar
            ?: $tenure->institution?->name
            ?: $tenure->institution_name_ar;

        return [
            'id' => $tenure->id,
            'official_id' => $tenure->official_id,
            'office_slot_id' => $tenure->office_slot_id,
            'office_slot_slug' => $tenure->officeSlot?->slug,
            'office_slot_title_ar' => $tenure->officeSlot?->title_ar,
            'institution_id' => $tenure->institution_id,
            'institution_name_ar' => $institutionName,
            'role_title_ar' => $tenure->role_title_ar,
            'tier' => $tenure->tier,
            'tier_label' => GovtCvVocabulary::label('tiers', $tenure->tier),
            'government_phase' => $tenure->government_phase,
            'government_phase_label' => GovtCvVocabulary::label('government_phases', $tenure->government_phase),
            'status' => $tenure->status,
            'status_label' => GovtCvVocabulary::label('tenure_statuses', $tenure->status),
            'started_at' => $tenure->started_at?->format('Y-m-d'),
            'start_date_precision' => $tenure->start_date_precision,
            'ended_at' => $tenure->ended_at?->format('Y-m-d'),
            'end_date_precision' => $tenure->end_date_precision,
            'is_acting' => (bool) $tenure->is_acting,
        ];
    }

    /**
     * @param  array{predecessor: array<string, mixed>|null, successor: array<string, mixed>|null}  $lineage
     * @return array<string, mixed>
     */
    public function tenureItem(GovtTenure $tenure, array $lineage = ['predecessor' => null, 'successor' => null]): array
    {
        $brief = $this->tenureBrief($tenure);

        return $brief + [
            'start_date_precision_label' => GovtCvVocabulary::label('date_precisions', $tenure->start_date_precision),
            'start_decree_ref' => $tenure->start_decree_ref,
            'end_date_precision_label' => GovtCvVocabulary::label('date_precisions', $tenure->end_date_precision),
            'end_reason' => $tenure->end_reason,
            'end_reason_label' => GovtCvVocabulary::label('end_reasons', $tenure->end_reason),
            'end_decree_ref' => $tenure->end_decree_ref,
            'first_operational_seen_at' => $tenure->first_operational_seen_at?->format('Y-m-d'),
            'last_operational_seen_at' => $tenure->last_operational_seen_at?->format('Y-m-d'),
            'operational_mentions_count' => (int) $tenure->operational_mentions_count,
            'notes_ar' => $tenure->notes_ar,
            'office_slot' => $tenure->officeSlot ? [
                'id' => $tenure->officeSlot->id,
                'slug' => $tenure->officeSlot->slug,
                'title_ar' => $tenure->officeSlot->title_ar,
                'status' => $tenure->officeSlot->status,
                'lineage_note_ar' => $tenure->officeSlot->lineage_note_ar,
                'replaced_by_slot_id' => $tenure->officeSlot->replaced_by_slot_id,
            ] : null,
            'predecessor' => $lineage['predecessor'] ?? null,
            'successor' => $lineage['successor'] ?? null,
            'evidence_links' => $tenure->relationLoaded('evidenceLinks')
                ? $tenure->evidenceLinks->map(fn (GovtEvidenceLink $e) => $this->evidenceItem($e))->values()->all()
                : [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function cvEntryItem(GovtCvEntry $entry): array
    {
        return [
            'id' => $entry->id,
            'official_id' => $entry->official_id,
            'section' => $entry->section,
            'section_label' => GovtCvVocabulary::label('cv_sections', $entry->section),
            'title_ar' => $entry->title_ar,
            'organization_ar' => $entry->organization_ar,
            'location_ar' => $entry->location_ar,
            'start_year' => $entry->start_year,
            'end_year' => $entry->end_year,
            'is_ongoing' => (bool) $entry->is_ongoing,
            'details_ar' => $entry->details_ar,
            'sort_order' => (int) $entry->sort_order,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function evidenceItem(GovtEvidenceLink $evidence): array
    {
        return [
            'id' => $evidence->id,
            'official_id' => $evidence->official_id,
            'tenure_id' => $evidence->tenure_id,
            'evidence_type' => $evidence->evidence_type,
            'evidence_type_label' => GovtCvVocabulary::label('evidence_types', $evidence->evidence_type),
            'paperless_record_id' => $evidence->paperless_record_id,
            'paperless_channel_id' => $evidence->paperless_channel_id,
            'paperless_message_id' => $evidence->paperless_message_id,
            'chunk_type' => $evidence->chunk_type,
            'source_title_ar' => $evidence->source_title_ar,
            'source_channel_ar' => $evidence->source_channel_ar,
            'source_url' => $evidence->source_url,
            'published_date' => $evidence->published_date?->format('Y-m-d'),
            'excerpt_ar' => $evidence->excerpt_ar,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function aliasItem(GovtOfficialAlias $alias): array
    {
        return [
            'id' => $alias->id,
            'official_id' => $alias->official_id,
            'alias_ar' => $alias->alias_ar,
            'alias_type' => $alias->alias_type,
            'alias_type_label' => GovtCvVocabulary::label('alias_types', $alias->alias_type),
            'source_note' => $alias->source_note,
        ];
    }

    /**
     * Resolve predecessor and successor for a batch of tenures sharing `office_slot_id`,
     * ordered chronologically by `(started_at ?? first_operational_seen_at ?? created_at, id)`.
     *
     * @param  Collection<int, GovtTenure>  $tenures
     * @return array<string, array{predecessor: array<string, mixed>|null, successor: array<string, mixed>|null}>
     */
    public function resolveSlotLineage(Collection $tenures, bool $publishedOnly = true): array
    {
        $slotIds = $tenures->pluck('office_slot_id')->filter()->unique()->values()->all();
        if ($slotIds === []) {
            return [];
        }

        $allSlotTenures = GovtTenure::query()
            ->with(['official'])
            ->whereIn('office_slot_id', $slotIds)
            ->when($publishedOnly, fn ($q) => $q->whereHas('official', fn ($oq) => $oq->published()))
            ->get();

        $bySlot = $allSlotTenures->groupBy('office_slot_id');
        $result = [];

        foreach ($bySlot as $slotTenures) {
            /** @var Collection<int, GovtTenure> $ordered */
            $ordered = $slotTenures->sort(function (GovtTenure $a, GovtTenure $b): int {
                $dateA = $a->started_at?->format('Y-m-d')
                    ?? $a->first_operational_seen_at?->format('Y-m-d')
                    ?? '0000-00-00';
                $dateB = $b->started_at?->format('Y-m-d')
                    ?? $b->first_operational_seen_at?->format('Y-m-d')
                    ?? '0000-00-00';

                if ($dateA !== $dateB) {
                    return $dateA <=> $dateB;
                }

                // Ended tenures come before current tenures if start date ties.
                $rankA = $a->status === 'ended' ? 0 : 1;
                $rankB = $b->status === 'ended' ? 0 : 1;
                if ($rankA !== $rankB) {
                    return $rankA <=> $rankB;
                }

                return (string) $a->id <=> (string) $b->id;
            })->values();

            $count = $ordered->count();
            for ($i = 0; $i < $count; $i++) {
                $current = $ordered[$i];
                $prev = $i > 0 ? $ordered[$i - 1] : null;
                $next = ($i + 1 < $count) ? $ordered[$i + 1] : null;

                $prevName = $prev?->official ? ($prev->official->display_name_ar ?: $prev->official->full_name_ar) : null;
                $nextName = $next?->official ? ($next->official->display_name_ar ?: $next->official->full_name_ar) : null;

                $result[$current->id] = [
                    'predecessor' => ($prev && $prev->official && $prev->official_id !== $current->official_id) ? [
                        'tenure_id' => $prev->id,
                        'official_id' => $prev->official->id,
                        'slug' => $prev->official->slug,
                        'official_slug' => $prev->official->slug,
                        'display_name_ar' => $prevName,
                        'official_name_ar' => $prevName,
                        'role_title_ar' => $prev->role_title_ar,
                        'started_at' => $prev->started_at?->format('Y-m-d'),
                        'ended_at' => $prev->ended_at?->format('Y-m-d'),
                    ] : null,
                    'successor' => ($next && $next->official && $next->official_id !== $current->official_id) ? [
                        'tenure_id' => $next->id,
                        'official_id' => $next->official->id,
                        'slug' => $next->official->slug,
                        'official_slug' => $next->official->slug,
                        'display_name_ar' => $nextName,
                        'official_name_ar' => $nextName,
                        'role_title_ar' => $next->role_title_ar,
                        'started_at' => $next->started_at?->format('Y-m-d'),
                        'ended_at' => $next->ended_at?->format('Y-m-d'),
                    ] : null,
                ];
            }
        }

        return $result;
    }

    /**
     * Published promises attributed to this official's linked `promise_speaker_id`.
     *
     * @return array<int, array<string, mixed>>
     */
    public function relatedPromises(GovtOfficial $official): array
    {
        if (! $official->promise_speaker_id) {
            return [];
        }

        $today = Promise::today();

        return Promise::published()
            ->where(function ($q) use ($official) {
                $q->where('speaker_id', $official->promise_speaker_id)
                    ->orWhereHas('coSpeakerRows', fn ($cq) => $cq->where('speaker_id', $official->promise_speaker_id));
            })
            ->orderByDesc('statement_date')
            ->orderByDesc('number')
            ->limit(15)
            ->get()
            ->map(function (Promise $p) use ($today): array {
                $state = $p->displayState($today);

                return [
                    'id' => $p->id,
                    'number' => $p->number,
                    'title' => $p->title,
                    'status' => $p->status,
                    'state' => $state,
                    'display_state' => $state,
                    'statement_date' => $p->statement_date?->format('Y-m-d'),
                    'deadline_date' => $p->deadline_date?->format('Y-m-d'),
                    'url' => '/promises/'.$p->number,
                ];
            })
            ->values()
            ->all();
    }
}
