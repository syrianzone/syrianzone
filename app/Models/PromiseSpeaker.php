<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * The person who made a promise.
 *
 * Rows link back to people the site already knows (tier-list candidates,
 * officials-directory entries, People's Assembly members) so photos and handles
 * are read from there instead of being re-entered. A row with none of the links
 * is a person added by an editor or proposed by the public.
 */
class PromiseSpeaker extends Model
{
    use HasFactory, HasUuids;

    public const STATUSES = ['approved', 'pending', 'rejected'];

    protected $fillable = [
        'name', 'title', 'institution_id', 'image_url', 'x_handle',
        'candidate_id', 'official_entity_id', 'house_member_id',
        'status', 'submitted_by', 'reviewed_by', 'reviewed_at', 'rejection_reason',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'house_member_id' => 'integer',
    ];

    public function promises(): HasMany
    {
        return $this->hasMany(Promise::class, 'speaker_id');
    }

    public function institution(): BelongsTo
    {
        return $this->belongsTo(OfficialEntity::class, 'institution_id');
    }

    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class, 'candidate_id');
    }

    public function officialEntity(): BelongsTo
    {
        return $this->belongsTo(OfficialEntity::class, 'official_entity_id');
    }

    public function houseMember(): BelongsTo
    {
        return $this->belongsTo(HouseMember2026::class, 'house_member_id');
    }

    /** @param  Builder<PromiseSpeaker>  $query */
    public function scopeApproved(Builder $query): Builder
    {
        return $query->where('status', 'approved');
    }

    /**
     * People proposed by the public, waiting in the review queue.
     *
     * @param  Builder<PromiseSpeaker>  $query
     */
    public function scopeInReviewQueue(Builder $query): Builder
    {
        return $query->where('status', 'pending');
    }

    /** How the promise forms and agent tools refer to this person (see SpeakerDirectory::resolve). */
    public function ref(): string
    {
        return 'speaker:'.$this->id;
    }

    /** Own photo first, then whatever the linked record carries. */
    public function resolvedImage(): ?string
    {
        return $this->image_url
            ?: $this->candidate?->image_url
            ?: $this->officialEntity?->image
            ?: null;
    }

    public function resolvedXHandle(): ?string
    {
        if ($this->x_handle) {
            return $this->x_handle;
        }
        if ($this->candidate?->x_handle) {
            return $this->candidate->x_handle;
        }

        $twitter = $this->officialEntity?->socials['twitter'] ?? $this->houseMember?->twitter_url;
        if (is_string($twitter) && preg_match('~(?:x|twitter)\.com/([A-Za-z0-9_]{1,15})~', $twitter, $m)) {
            return $m[1];
        }

        return null;
    }

    /** Which existing record this speaker is linked to, for admin display. */
    public function linkKind(): ?string
    {
        return match (true) {
            $this->candidate_id !== null => 'candidate',
            $this->official_entity_id !== null => 'official',
            $this->house_member_id !== null => 'house',
            default => null,
        };
    }

    /** @return array<string, mixed> */
    public function toPublicPayload(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'title' => $this->title,
            'image' => $this->resolvedImage(),
            'xHandle' => $this->resolvedXHandle(),
        ];
    }

    /** @return array<string, mixed> */
    public function toAdminPayload(): array
    {
        return $this->toPublicPayload() + [
            'imageUrl' => $this->image_url,
            'institutionId' => $this->institution_id,
            'institutionName' => $this->institution?->name_ar ?: $this->institution?->name,
            'status' => $this->status,
            'link' => $this->linkKind(),
            'candidateId' => $this->candidate_id,
            'officialEntityId' => $this->official_entity_id,
            'houseMemberId' => $this->house_member_id,
            'promisesCount' => (int) ($this->promises_count ?? 0),
            'rejectionReason' => $this->rejection_reason,
        ];
    }
}
