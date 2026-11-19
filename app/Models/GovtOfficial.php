<?php

namespace App\Models;

use App\Models\Concerns\FoldsSearchColumns;
use App\Support\ArabicSearch;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A Syrian government official tracked in the Government CVs & Tenure Tracker
 * (`السير الذاتية للمسؤولين`) since 8 December 2024.
 */
class GovtOfficial extends Model
{
    use FoldsSearchColumns, HasFactory, HasUuids;

    protected $table = 'govt_officials';

    protected $fillable = [
        'slug',
        'full_name_ar',
        'display_name_ar',
        'full_name_en',
        'honorific_ar',
        'bio_summary_ar',
        'office_status',
        'highest_tier',
        'birth_year',
        'birth_place_ar',
        'gender',
        'languages',
        'portrait_url',
        'cv_completeness',
        'first_seen_in_office_at',
        'last_seen_in_office_at',
        'candidate_id',
        'promise_speaker_id',
        'official_entity_id',
        'house_member_id',
        'publish_status',
        'verification_level',
        'version',
        'published_at',
    ];

    protected $casts = [
        'birth_year' => 'integer',
        'languages' => 'array',
        'first_seen_in_office_at' => 'date:Y-m-d',
        'last_seen_in_office_at' => 'date:Y-m-d',
        'house_member_id' => 'integer',
        'version' => 'integer',
        'published_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::saving(function (self $official): void {
            foreach (['full_name_ar', 'display_name_ar', 'bio_summary_ar'] as $column) {
                $val = $official->getAttribute($column);
                $official->setAttribute(
                    $column.'_fold',
                    $val === null ? null : ArabicSearch::fold((string) $val),
                );
            }
        });
    }

    /** @param  Builder<self>  $query */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('publish_status', 'published');
    }

    public function aliases(): HasMany
    {
        return $this->hasMany(GovtOfficialAlias::class, 'official_id')->orderBy('id');
    }

    public function tenures(): HasMany
    {
        return $this->hasMany(GovtTenure::class, 'official_id')
            ->orderByRaw("CASE WHEN status = 'current' THEN 0 ELSE 1 END")
            ->orderByDesc('started_at')
            ->orderBy('id');
    }

    public function currentTenures(): HasMany
    {
        return $this->hasMany(GovtTenure::class, 'official_id')
            ->where('status', 'current')
            ->orderByDesc('started_at')
            ->orderBy('id');
    }

    public function cvEntries(): HasMany
    {
        return $this->hasMany(GovtCvEntry::class, 'official_id')
            ->orderBy('sort_order')
            ->orderByDesc('start_year')
            ->orderBy('id');
    }

    public function evidenceLinks(): HasMany
    {
        return $this->hasMany(GovtEvidenceLink::class, 'official_id')
            ->orderByDesc('published_date')
            ->orderBy('id');
    }

    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class, 'candidate_id');
    }

    public function promiseSpeaker(): BelongsTo
    {
        return $this->belongsTo(PromiseSpeaker::class, 'promise_speaker_id');
    }

    public function officialEntity(): BelongsTo
    {
        return $this->belongsTo(OfficialEntity::class, 'official_entity_id');
    }

    public function houseMember(): BelongsTo
    {
        return $this->belongsTo(HouseMember2026::class, 'house_member_id');
    }

    /**
     * Resolve the official's portrait URL:
     * 1. Explicit `portrait_url` on this record
     * 2. Linked `officialEntity->image` (guarded against `pf-safwat-raslan`'s broken
     *    `pf-abdulkader-husrieh.webp` image pointer)
     * 3. Linked `candidate->image_url`
     * 4. Linked `promiseSpeaker->resolvedImage()`
     */
    public function resolvedPortrait(): ?string
    {
        if (filled($this->portrait_url)) {
            return $this->portrait_url;
        }

        $entityImage = $this->officialEntity?->image;
        if (filled($entityImage)) {
            $isMismatchedRaslanImage = $this->official_entity_id === 'pf-safwat-raslan'
                && str_contains((string) $entityImage, 'pf-abdulkader-husrieh');

            if (! $isMismatchedRaslanImage) {
                return $entityImage;
            }
        }

        if (filled($this->candidate?->image_url)) {
            return $this->candidate->image_url;
        }

        if ($this->promiseSpeaker) {
            $speakerImg = $this->promiseSpeaker->resolvedImage();
            if (filled($speakerImg)) {
                $isMismatchedRaslanImage = $this->official_entity_id === 'pf-safwat-raslan'
                    && str_contains((string) $speakerImg, 'pf-abdulkader-husrieh');
                if (! $isMismatchedRaslanImage) {
                    return $speakerImg;
                }
            }
        }

        return null;
    }

    /**
     * Resolve social media links and X handle from linked OfficialEntity, Candidate,
     * PromiseSpeaker, and HouseMember2026 records.
     *
     * @return array<string, string>
     */
    public function resolvedSocials(): array
    {
        $socials = [];

        if (is_array($this->officialEntity?->socials)) {
            foreach ($this->officialEntity->socials as $platform => $url) {
                if (is_string($url) && trim($url) !== '') {
                    $socials[(string) $platform] = trim($url);
                }
            }
        }

        if ($this->houseMember) {
            if (filled($this->houseMember->twitter_url) && empty($socials['twitter'])) {
                $socials['twitter'] = trim((string) $this->houseMember->twitter_url);
            }
            if (filled($this->houseMember->facebook_url) && empty($socials['facebook'])) {
                $socials['facebook'] = trim((string) $this->houseMember->facebook_url);
            }
        }

        $xHandle = $this->candidate?->x_handle ?: $this->promiseSpeaker?->resolvedXHandle();
        if (! $xHandle && ! empty($socials['twitter'])) {
            if (preg_match('~(?:x|twitter)\.com/([A-Za-z0-9_]{1,15})~', $socials['twitter'], $m)) {
                $xHandle = $m[1];
            }
        }

        if (filled($xHandle)) {
            $cleanHandle = ltrim(trim((string) $xHandle), '@');
            $socials['x_handle'] = $cleanHandle;
            if (empty($socials['twitter'])) {
                $socials['twitter'] = 'https://x.com/'.$cleanHandle;
            }
        }

        return $socials;
    }
}
