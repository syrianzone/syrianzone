<?php

namespace App\Services\GovtCvs;

use App\Exceptions\GovtCvActionException;
use App\Models\GovtCvEntry;
use App\Models\GovtEvidenceLink;
use App\Models\GovtOfficial;
use App\Models\GovtOfficialAlias;
use App\Models\User;
use App\Support\ArabicPersonName;
use App\Support\ArabicSearch;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Writes to `GovtOfficial`, its aliases, CV entries, evidence links, and portrait uploads,
 * transport-free.
 */
final class GovtOfficialEditor
{
    public function __construct(private readonly GovtTenureTracker $tracker) {}

    public function findOfficial(string $id): GovtOfficial
    {
        return GovtOfficial::find($id)
            ?? GovtOfficial::where('slug', $id)->first()
            ?? throw GovtCvActionException::notFound();
    }

    public function findCvEntry(string $id, ?GovtOfficial $official = null): GovtCvEntry
    {
        $query = GovtCvEntry::query();
        if ($official !== null) {
            $query->where('official_id', $official->id);
        }

        return $query->find($id) ?? throw GovtCvActionException::notFound('بند السيرة الذاتية');
    }

    public function findEvidenceLink(string $id, ?GovtOfficial $official = null): GovtEvidenceLink
    {
        $query = GovtEvidenceLink::query();
        if ($official !== null) {
            $query->where('official_id', $official->id);
        }

        return $query->find($id) ?? throw GovtCvActionException::notFound('الدليل');
    }

    /**
     * Create or update a `GovtOfficial` record.
     *
     * Enforces optimistic `version` locking on updates when `version` is provided
     * in `$data`, generates or validates unique slugs, syncs `aliases` when present,
     * and recomputes derived official summary fields.
     *
     * @param  array<string, mixed>  $data
     */
    public function saveOfficial(?GovtOfficial $official, array $data, ?User $actor = null): GovtOfficial
    {
        return DB::transaction(function () use ($official, $data) {
            if ($official !== null) {
                $official = GovtOfficial::query()->lockForUpdate()->find($official->id)
                    ?? throw GovtCvActionException::notFound();

                if (isset($data['version']) && (int) $data['version'] !== (int) $official->version) {
                    throw GovtCvActionException::staleEdit((int) $official->version);
                }
            }

            $fullNameAr = trim((string) ($data['full_name_ar'] ?? $official?->full_name_ar ?? ''));
            $displayNameAr = trim((string) ($data['display_name_ar'] ?? $official?->display_name_ar ?? ''));
            if ($displayNameAr === '') {
                $displayNameAr = ArabicPersonName::cleanName($fullNameAr) ?: $fullNameAr;
            }

            $honorificAr = array_key_exists('honorific_ar', $data)
                ? $data['honorific_ar']
                : ($official ? $official->honorific_ar : ArabicPersonName::extractHonorific($fullNameAr));

            $fullNameEn = array_key_exists('full_name_en', $data) ? $data['full_name_en'] : $official?->full_name_en;

            $rawSlug = trim((string) ($data['slug'] ?? $official?->slug ?? ''));
            $slug = $rawSlug !== ''
                ? $rawSlug
                : $this->uniqueSlug($fullNameEn ?: $displayNameAr ?: $fullNameAr, $official?->id);

            if (GovtOfficial::query()->where('slug', $slug)->when($official, fn ($q) => $q->whereKeyNot($official->id))->exists()) {
                throw GovtCvActionException::slugTaken($slug);
            }

            $publishStatus = (string) ($data['publish_status'] ?? $official?->publish_status ?? 'draft');
            $publishedAt = $official?->published_at;
            if ($publishStatus === 'published' && $publishedAt === null) {
                $publishedAt = now();
            }

            $attributes = [
                'slug' => $slug,
                'full_name_ar' => $fullNameAr,
                'display_name_ar' => $displayNameAr,
                'full_name_en' => $fullNameEn,
                'honorific_ar' => $honorificAr,
                'bio_summary_ar' => array_key_exists('bio_summary_ar', $data) ? $data['bio_summary_ar'] : $official?->bio_summary_ar,
                'office_status' => (string) ($data['office_status'] ?? $official?->office_status ?? 'in_office'),
                'highest_tier' => (string) ($data['highest_tier'] ?? $official?->highest_tier ?? 'minister'),
                'birth_year' => array_key_exists('birth_year', $data) ? $data['birth_year'] : $official?->birth_year,
                'birth_place_ar' => array_key_exists('birth_place_ar', $data) ? $data['birth_place_ar'] : $official?->birth_place_ar,
                'gender' => array_key_exists('gender', $data) ? $data['gender'] : $official?->gender,
                'languages' => array_key_exists('languages', $data) ? $data['languages'] : $official?->languages,
                'portrait_url' => array_key_exists('portrait_url', $data) ? $data['portrait_url'] : $official?->portrait_url,
                'cv_completeness' => (string) ($data['cv_completeness'] ?? $official?->cv_completeness ?? 'positions_only'),
                'first_seen_in_office_at' => array_key_exists('first_seen_in_office_at', $data)
                    ? $data['first_seen_in_office_at']
                    : $official?->first_seen_in_office_at?->format('Y-m-d'),
                'last_seen_in_office_at' => array_key_exists('last_seen_in_office_at', $data)
                    ? $data['last_seen_in_office_at']
                    : $official?->last_seen_in_office_at?->format('Y-m-d'),
                'candidate_id' => array_key_exists('candidate_id', $data) ? $data['candidate_id'] : $official?->candidate_id,
                'promise_speaker_id' => array_key_exists('promise_speaker_id', $data) ? $data['promise_speaker_id'] : $official?->promise_speaker_id,
                'official_entity_id' => array_key_exists('official_entity_id', $data) ? $data['official_entity_id'] : $official?->official_entity_id,
                'house_member_id' => array_key_exists('house_member_id', $data) ? $data['house_member_id'] : $official?->house_member_id,
                'publish_status' => $publishStatus,
                'verification_level' => (string) ($data['verification_level'] ?? $official?->verification_level ?? 'editorial'),
                'published_at' => $publishedAt,
            ];

            if ($official === null) {
                $official = GovtOfficial::create($attributes + ['version' => 1]);
            } else {
                $official->update($attributes);
                $official->increment('version');
            }

            if (array_key_exists('aliases', $data) && is_array($data['aliases'])) {
                $this->syncAliases($official, $data['aliases']);
            }

            return $this->tracker->recomputeOfficialSummary($official->fresh());
        });
    }

    public function publish(GovtOfficial $official): GovtOfficial
    {
        $official->update([
            'publish_status' => 'published',
            'published_at' => $official->published_at ?? now(),
            'version' => ((int) $official->version) + 1,
        ]);

        return $official->fresh();
    }

    public function archive(GovtOfficial $official): GovtOfficial
    {
        $official->update([
            'publish_status' => 'archived',
            'version' => ((int) $official->version) + 1,
        ]);

        return $official->fresh();
    }

    public function deleteOfficial(GovtOfficial $official): void
    {
        $official->delete();
    }

    /**
     * Upload a portrait photo for an official to R2 (or local public disk fallback)
     * under `govtcvs/portraits/`.
     */
    public function uploadPortrait(GovtOfficial $official, UploadedFile $file): GovtOfficial
    {
        $filename = $official->slug.'-'.Str::lower(Str::random(6)).'.'.$file->extension();

        if (config('filesystems.media_disk', 'public') === 'r2' && ! empty(config('filesystems.disks.r2.bucket'))) {
            $path = "govtcvs/portraits/{$filename}";
            $disk = Storage::disk('r2');
            $disk->putFileAs('govtcvs/portraits', $file, $filename, 'public');
            $url = $disk->url($path);
        } else {
            $rel = "images/govtcvs/portraits/{$filename}";
            Storage::disk('public')->putFileAs('images/govtcvs/portraits', $file, $filename);
            $url = '/storage/'.$rel;
        }

        $official->update([
            'portrait_url' => $url,
            'version' => ((int) $official->version) + 1,
        ]);

        return $official->fresh();
    }

    /**
     * Create or update a CV entry on an official.
     *
     * @param  array<string, mixed>  $data
     */
    public function saveCvEntry(GovtOfficial $official, ?GovtCvEntry $entry, array $data): GovtCvEntry
    {
        return DB::transaction(function () use ($official, $entry, $data) {
            $sortOrder = array_key_exists('sort_order', $data) && $data['sort_order'] !== null
                ? (int) $data['sort_order']
                : ($entry !== null ? (int) $entry->sort_order : ((int) ($official->cvEntries()->max('sort_order') ?? -1) + 1));

            $attributes = [
                'official_id' => $official->id,
                'section' => (string) ($data['section'] ?? $entry?->section ?? 'career_history'),
                'title_ar' => trim((string) ($data['title_ar'] ?? $entry?->title_ar ?? '')),
                'organization_ar' => array_key_exists('organization_ar', $data) ? $data['organization_ar'] : $entry?->organization_ar,
                'location_ar' => array_key_exists('location_ar', $data) ? $data['location_ar'] : $entry?->location_ar,
                'start_year' => array_key_exists('start_year', $data) ? $data['start_year'] : $entry?->start_year,
                'end_year' => array_key_exists('end_year', $data) ? $data['end_year'] : $entry?->end_year,
                'is_ongoing' => array_key_exists('is_ongoing', $data) ? (bool) $data['is_ongoing'] : (bool) ($entry?->is_ongoing ?? false),
                'details_ar' => array_key_exists('details_ar', $data) ? $data['details_ar'] : $entry?->details_ar,
                'sort_order' => $sortOrder,
            ];

            if ($entry === null) {
                $entry = GovtCvEntry::create($attributes);
            } else {
                $entry->update($attributes);
            }

            $this->tracker->recomputeOfficialSummary($official);

            return $entry->fresh();
        });
    }

    public function deleteCvEntry(GovtCvEntry $entry): void
    {
        DB::transaction(function () use ($entry) {
            $official = $entry->official;
            $entry->delete();

            if ($official) {
                $this->tracker->recomputeOfficialSummary($official);
            }
        });
    }

    /**
     * Reorder CV entries on an official according to the given ordered IDs.
     *
     * @param  array<int, string>  $orderedIds
     */
    public function reorderCvEntries(GovtOfficial $official, array $orderedIds): void
    {
        DB::transaction(function () use ($official, $orderedIds) {
            foreach (array_values($orderedIds) as $index => $entryId) {
                GovtCvEntry::query()
                    ->where('official_id', $official->id)
                    ->where('id', $entryId)
                    ->update(['sort_order' => $index]);
            }
            $official->touch();
        });
    }

    /**
     * Create or update a sourced evidence link on an official.
     *
     * @param  array<string, mixed>  $data
     */
    public function saveEvidenceLink(GovtOfficial $official, ?GovtEvidenceLink $evidence, array $data): GovtEvidenceLink
    {
        return DB::transaction(function () use ($official, $evidence, $data) {
            $tenureId = array_key_exists('tenure_id', $data) ? $data['tenure_id'] : $evidence?->tenure_id;
            if ($tenureId !== null && ! $official->tenures()->whereKey($tenureId)->exists()) {
                $tenureId = null;
            }

            $attributes = [
                'official_id' => $official->id,
                'tenure_id' => $tenureId,
                'evidence_type' => (string) ($data['evidence_type'] ?? $evidence?->evidence_type ?? 'operational_mention'),
                'paperless_record_id' => array_key_exists('paperless_record_id', $data) ? $data['paperless_record_id'] : $evidence?->paperless_record_id,
                'paperless_channel_id' => array_key_exists('paperless_channel_id', $data) ? $data['paperless_channel_id'] : $evidence?->paperless_channel_id,
                'paperless_message_id' => array_key_exists('paperless_message_id', $data) ? $data['paperless_message_id'] : $evidence?->paperless_message_id,
                'chunk_type' => array_key_exists('chunk_type', $data) ? $data['chunk_type'] : $evidence?->chunk_type,
                'source_title_ar' => trim((string) ($data['source_title_ar'] ?? $evidence?->source_title_ar ?? '')),
                'source_channel_ar' => array_key_exists('source_channel_ar', $data) ? $data['source_channel_ar'] : $evidence?->source_channel_ar,
                'source_url' => array_key_exists('source_url', $data) ? $data['source_url'] : $evidence?->source_url,
                'published_date' => array_key_exists('published_date', $data)
                    ? $data['published_date']
                    : $evidence?->published_date?->format('Y-m-d'),
                'excerpt_ar' => array_key_exists('excerpt_ar', $data) ? $data['excerpt_ar'] : $evidence?->excerpt_ar,
            ];

            if ($evidence === null) {
                $evidence = GovtEvidenceLink::create($attributes);
            } else {
                $evidence->update($attributes);
            }

            $official->touch();

            return $evidence->fresh();
        });
    }

    public function deleteEvidenceLink(GovtEvidenceLink $evidence): void
    {
        $official = $evidence->official;
        $evidence->delete();
        $official?->touch();
    }

    /**
     * Replace the official's aliases, dropping duplicates by folded comparison key.
     *
     * @param  array<int, array<string, mixed>|string>  $aliases
     */
    public function syncAliases(GovtOfficial $official, array $aliases): void
    {
        $official->aliases()->delete();

        $seen = [];
        foreach ($aliases as $item) {
            $aliasAr = is_string($item) ? trim($item) : trim((string) ($item['alias_ar'] ?? ''));
            if ($aliasAr === '') {
                continue;
            }

            $fold = ArabicSearch::fold($aliasAr);
            if ($fold === '' || isset($seen[$fold])) {
                continue;
            }
            $seen[$fold] = true;

            $aliasType = is_array($item) && in_array($item['alias_type'] ?? '', GovtCvVocabulary::aliasTypes(), true)
                ? (string) $item['alias_type']
                : 'patronymic_short';

            GovtOfficialAlias::create([
                'official_id' => $official->id,
                'alias_ar' => $aliasAr,
                'alias_type' => $aliasType,
                'source_note' => is_array($item) ? ($item['source_note'] ?? null) : null,
            ]);
        }
    }

    private function uniqueSlug(string $sourceText, ?string $ignoreId = null): string
    {
        $base = ArabicPersonName::slug($sourceText, 'official');
        $slug = $base;
        $counter = 2;

        while (GovtOfficial::query()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists()) {
            $slug = $base.'-'.$counter++;
        }

        return $slug;
    }
}
