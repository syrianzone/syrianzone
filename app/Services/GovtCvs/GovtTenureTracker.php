<?php

namespace App\Services\GovtCvs;

use App\Exceptions\GovtCvActionException;
use App\Models\GovtOfficeSlot;
use App\Models\GovtOfficial;
use App\Models\GovtTenure;
use App\Models\OfficialEntity;
use App\Support\ArabicPersonName;
use Illuminate\Support\Facades\DB;

/**
 * Manages office slots (`govt_office_slots`), tenures (`govt_tenures`), automatic
 * single-seat incumbent closing, and official summary recomputation.
 */
final class GovtTenureTracker
{
    public function findSlot(string $id): GovtOfficeSlot
    {
        return GovtOfficeSlot::find($id) ?? throw GovtCvActionException::notFound('المنصب');
    }

    public function findTenure(string $id, ?GovtOfficial $official = null): GovtTenure
    {
        $query = GovtTenure::query();
        if ($official !== null) {
            $query->where('official_id', $official->id);
        }

        return $query->find($id) ?? throw GovtCvActionException::notFound('فترة الخدمة');
    }

    /**
     * Create or update an office slot.
     *
     * @param  array<string, mixed>  $data
     */
    public function saveSlot(?GovtOfficeSlot $slot, array $data): GovtOfficeSlot
    {
        return DB::transaction(function () use ($slot, $data) {
            $titleAr = trim((string) ($data['title_ar'] ?? $slot?->title_ar ?? ''));
            $rawSlug = trim((string) ($data['slug'] ?? $slot?->slug ?? ''));
            $slug = $rawSlug !== '' ? $rawSlug : $this->uniqueSlotSlug($titleAr, $slot?->id);

            if (GovtOfficeSlot::query()->where('slug', $slug)->when($slot, fn ($q) => $q->whereKeyNot($slot->id))->exists()) {
                throw GovtCvActionException::slugTaken($slug);
            }

            $institutionId = $this->resolveInstitutionId($data['institution_id'] ?? ($slot?->institution_id));
            $institutionNameAr = $data['institution_name_ar'] ?? ($slot?->institution_name_ar);
            if ($institutionId && blank($institutionNameAr)) {
                $entity = OfficialEntity::find($institutionId);
                $institutionNameAr = $entity?->name_ar ?: $entity?->name;
            }

            $attributes = [
                'slug' => $slug,
                'title_ar' => $titleAr,
                'institution_id' => $institutionId,
                'institution_name_ar' => $institutionNameAr,
                'tier' => $data['tier'] ?? $slot?->tier ?? 'minister',
                'is_single_seat' => array_key_exists('is_single_seat', $data)
                    ? (bool) $data['is_single_seat']
                    : ($slot ? (bool) $slot->is_single_seat : true),
                'status' => $data['status'] ?? $slot?->status ?? 'active',
                'active_from' => array_key_exists('active_from', $data) ? $data['active_from'] : $slot?->active_from,
                'ended_at' => array_key_exists('ended_at', $data) ? $data['ended_at'] : $slot?->ended_at,
                'lineage_note_ar' => array_key_exists('lineage_note_ar', $data) ? $data['lineage_note_ar'] : $slot?->lineage_note_ar,
                'replaced_by_slot_id' => array_key_exists('replaced_by_slot_id', $data) ? $data['replaced_by_slot_id'] : $slot?->replaced_by_slot_id,
            ];

            if ($slot === null) {
                return GovtOfficeSlot::create($attributes);
            }

            $slot->update($attributes);

            return $slot->fresh();
        });
    }

    public function deleteSlot(GovtOfficeSlot $slot): void
    {
        $count = $slot->tenures()->count();
        if ($count > 0) {
            throw GovtCvActionException::slotInUse($count);
        }

        $slot->delete();
    }

    /**
     * Create or update a tenure on an official.
     *
     * When `office_slot_id` points to a single-seat slot (`is_single_seat = true`)
     * and the new/updated tenure has `status === 'current'`, any other `current`
     * tenure on the same slot is automatically closed (`status = 'ended'`,
     * `ended_at = $data['started_at']`, `end_reason = 'replaced'`,
     * `end_date_precision = 'inferred_successor'`, `end_decree_ref = $data['start_decree_ref']`)
     * unless `$data['auto_close_incumbent']` is explicitly `false`.
     *
     * Recomputes summary fields for both the target official and any auto-closed incumbent.
     *
     * @param  array<string, mixed>  $data
     */
    public function saveTenure(GovtOfficial $official, ?GovtTenure $tenure, array $data): GovtTenure
    {
        return DB::transaction(function () use ($official, $tenure, $data) {
            $startedAt = array_key_exists('started_at', $data) ? $data['started_at'] : $tenure?->started_at?->format('Y-m-d');
            $endedAt = array_key_exists('ended_at', $data) ? $data['ended_at'] : $tenure?->ended_at?->format('Y-m-d');

            if ($startedAt && $endedAt && $endedAt < $startedAt) {
                throw GovtCvActionException::dateOutOfOrder((string) $startedAt, (string) $endedAt);
            }

            $officeSlotId = array_key_exists('office_slot_id', $data) ? $data['office_slot_id'] : $tenure?->office_slot_id;
            $slot = $officeSlotId ? GovtOfficeSlot::find($officeSlotId) : null;

            $institutionId = $this->resolveInstitutionId(
                array_key_exists('institution_id', $data)
                    ? $data['institution_id']
                    : ($tenure?->institution_id ?? $slot?->institution_id),
            );

            $institutionNameAr = array_key_exists('institution_name_ar', $data)
                ? $data['institution_name_ar']
                : ($tenure?->institution_name_ar ?? $slot?->institution_name_ar);

            if ($institutionId && blank($institutionNameAr)) {
                $entity = OfficialEntity::find($institutionId);
                $institutionNameAr = $entity?->name_ar ?: $entity?->name;
            }

            $status = (string) ($data['status'] ?? $tenure?->status ?? ($endedAt ? 'ended' : 'current'));

            $attributes = [
                'official_id' => $official->id,
                'office_slot_id' => $slot?->id,
                'institution_id' => $institutionId,
                'institution_name_ar' => $institutionNameAr,
                'role_title_ar' => trim((string) ($data['role_title_ar'] ?? $tenure?->role_title_ar ?? $slot?->title_ar ?? '')),
                'tier' => (string) ($data['tier'] ?? $tenure?->tier ?? $slot?->tier ?? 'minister'),
                'government_phase' => (string) ($data['government_phase'] ?? $tenure?->government_phase ?? 'transitional_2025'),
                'status' => $status,
                'started_at' => $startedAt,
                'start_date_precision' => (string) ($data['start_date_precision'] ?? $tenure?->start_date_precision ?? 'exact'),
                'start_decree_ref' => array_key_exists('start_decree_ref', $data) ? $data['start_decree_ref'] : $tenure?->start_decree_ref,
                'ended_at' => $status === 'current' ? null : $endedAt,
                'end_date_precision' => $status === 'current'
                    ? null
                    : (array_key_exists('end_date_precision', $data) ? $data['end_date_precision'] : $tenure?->end_date_precision),
                'end_reason' => $status === 'current'
                    ? null
                    : (array_key_exists('end_reason', $data) ? $data['end_reason'] : $tenure?->end_reason),
                'end_decree_ref' => $status === 'current'
                    ? null
                    : (array_key_exists('end_decree_ref', $data) ? $data['end_decree_ref'] : $tenure?->end_decree_ref),
                'first_operational_seen_at' => array_key_exists('first_operational_seen_at', $data)
                    ? $data['first_operational_seen_at']
                    : $tenure?->first_operational_seen_at?->format('Y-m-d'),
                'last_operational_seen_at' => array_key_exists('last_operational_seen_at', $data)
                    ? $data['last_operational_seen_at']
                    : $tenure?->last_operational_seen_at?->format('Y-m-d'),
                'operational_mentions_count' => (int) ($data['operational_mentions_count'] ?? $tenure?->operational_mentions_count ?? 0),
                'is_acting' => array_key_exists('is_acting', $data)
                    ? (bool) $data['is_acting']
                    : (bool) ($tenure?->is_acting ?? false),
                'notes_ar' => array_key_exists('notes_ar', $data) ? $data['notes_ar'] : $tenure?->notes_ar,
            ];

            if ($tenure === null) {
                $tenure = GovtTenure::create($attributes);
            } else {
                $tenure->update($attributes);
            }

            $autoClose = (bool) ($data['auto_close_incumbent'] ?? true);
            $affectedOfficialIds = [$official->id];

            if ($autoClose && $slot && $slot->is_single_seat && $status === 'current') {
                $incumbents = GovtTenure::query()
                    ->where('office_slot_id', $slot->id)
                    ->where('status', 'current')
                    ->whereKeyNot($tenure->id)
                    ->get();

                foreach ($incumbents as $incumbent) {
                    $incumbentStart = $incumbent->started_at?->format('Y-m-d');
                    // Only auto-close if the incumbent started on or before the new tenure
                    if ($incumbentStart !== null && $startedAt !== null && $incumbentStart > $startedAt) {
                        continue;
                    }

                    $incumbent->update([
                        'status' => 'ended',
                        'ended_at' => $startedAt ?? $incumbent->ended_at?->format('Y-m-d') ?? now()->format('Y-m-d'),
                        'end_reason' => $incumbent->end_reason ?: 'replaced',
                        'end_date_precision' => $incumbent->end_date_precision ?: 'inferred_successor',
                        'end_decree_ref' => $incumbent->end_decree_ref ?: ($attributes['start_decree_ref'] ?? null),
                    ]);

                    $affectedOfficialIds[] = $incumbent->official_id;
                }
            }

            foreach (array_unique($affectedOfficialIds) as $officialId) {
                $targetOfficial = GovtOfficial::find($officialId);
                if ($targetOfficial) {
                    $this->recomputeOfficialSummary($targetOfficial);
                }
            }

            return $tenure->fresh();
        });
    }

    public function deleteTenure(GovtTenure $tenure): void
    {
        DB::transaction(function () use ($tenure) {
            $official = $tenure->official;
            $tenure->delete();

            if ($official) {
                $this->recomputeOfficialSummary($official);
            }
        });
    }

    /**
     * Recompute an official's derived summary fields from their tenures & CV entries:
     * - `first_seen_in_office_at`
     * - `last_seen_in_office_at`
     * - `highest_tier`
     * - `cv_completeness`
     * - `office_status` (preserved if `deceased`)
     */
    public function recomputeOfficialSummary(GovtOfficial $official): GovtOfficial
    {
        $official->load(['tenures', 'cvEntries']);

        $tenures = $official->tenures;
        $cvEntries = $official->cvEntries;

        // 1. First and last seen dates across all tenures
        $startDates = [];
        $endDates = [];

        foreach ($tenures as $t) {
            if ($t->started_at) {
                $startDates[] = $t->started_at->format('Y-m-d');
                $endDates[] = $t->started_at->format('Y-m-d');
            }
            if ($t->first_operational_seen_at) {
                $startDates[] = $t->first_operational_seen_at->format('Y-m-d');
                $endDates[] = $t->first_operational_seen_at->format('Y-m-d');
            }
            if ($t->last_operational_seen_at) {
                $endDates[] = $t->last_operational_seen_at->format('Y-m-d');
            }
            if ($t->ended_at) {
                $endDates[] = $t->ended_at->format('Y-m-d');
            }
        }

        $firstSeen = $startDates !== [] ? min($startDates) : $official->first_seen_in_office_at?->format('Y-m-d');
        $lastSeen = $endDates !== [] ? max($endDates) : $official->last_seen_in_office_at?->format('Y-m-d');

        // 2. Highest tier (lowest rank number)
        $highestTier = $official->highest_tier ?: 'minister';
        if ($tenures->isNotEmpty()) {
            $bestRank = 999;
            foreach ($tenures as $t) {
                $rank = GovtCvVocabulary::tierRank($t->tier);
                if ($rank < $bestRank) {
                    $bestRank = $rank;
                    $highestTier = $t->tier;
                }
            }
        }

        // 3. Office status (preserve 'deceased' if explicitly set or if any tenure ended due to 'deceased')
        $officeStatus = $official->office_status;
        $hasDeceasedTenure = $tenures->contains(fn (GovtTenure $t) => $t->end_reason === 'deceased');

        if ($officeStatus === 'deceased' || $hasDeceasedTenure) {
            $officeStatus = 'deceased';
        } elseif ($tenures->isNotEmpty()) {
            if ($tenures->contains(fn (GovtTenure $t) => $t->status === 'current')) {
                $officeStatus = 'in_office';
            } elseif ($tenures->contains(fn (GovtTenure $t) => $t->status === 'uncertain')) {
                $officeStatus = 'uncertain';
            } else {
                $officeStatus = 'out_of_office';
            }
        }

        // 4. CV completeness
        $cvCount = $cvEntries->count();
        $sectionsCount = $cvEntries->pluck('section')->unique()->count();
        $hasBio = filled($official->bio_summary_ar) && mb_strlen(trim((string) $official->bio_summary_ar)) >= 40;

        if ($cvCount >= 2 || ($cvCount >= 1 && ($sectionsCount >= 1 && ($hasBio || filled($official->birth_year))))) {
            $completeness = 'full_cv';
        } elseif ($cvCount >= 1 || $hasBio || filled($official->birth_year) || filled($official->birth_place_ar)) {
            $completeness = 'partial_bio';
        } else {
            $completeness = 'positions_only';
        }

        $official->update([
            'first_seen_in_office_at' => $firstSeen,
            'last_seen_in_office_at' => $lastSeen,
            'highest_tier' => $highestTier,
            'office_status' => $officeStatus,
            'cv_completeness' => $completeness,
        ]);

        return $official->fresh();
    }

    private function resolveInstitutionId(?string $institutionId): ?string
    {
        if ($institutionId === null || trim($institutionId) === '') {
            return null;
        }

        return OfficialEntity::whereKey($institutionId)->exists() ? $institutionId : null;
    }

    private function uniqueSlotSlug(string $titleAr, ?string $ignoreId = null): string
    {
        $base = ArabicPersonName::slug($titleAr, 'slot');
        $slug = $base;
        $counter = 2;

        while (GovtOfficeSlot::query()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists()) {
            $slug = $base.'-'.$counter++;
        }

        return $slug;
    }
}
