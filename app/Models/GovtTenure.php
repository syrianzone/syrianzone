<?php

namespace App\Models;

use App\Models\Concerns\FoldsSearchColumns;
use App\Support\ArabicSearch;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A period of service in a government role held by a GovtOfficial.
 */
class GovtTenure extends Model
{
    use FoldsSearchColumns, HasFactory, HasUuids;

    protected $table = 'govt_tenures';

    protected $fillable = [
        'official_id',
        'office_slot_id',
        'institution_id',
        'institution_name_ar',
        'role_title_ar',
        'tier',
        'government_phase',
        'status',
        'started_at',
        'start_date_precision',
        'start_decree_ref',
        'ended_at',
        'end_date_precision',
        'end_reason',
        'end_decree_ref',
        'first_operational_seen_at',
        'last_operational_seen_at',
        'operational_mentions_count',
        'is_acting',
        'notes_ar',
    ];

    protected $casts = [
        'started_at' => 'date:Y-m-d',
        'ended_at' => 'date:Y-m-d',
        'first_operational_seen_at' => 'date:Y-m-d',
        'last_operational_seen_at' => 'date:Y-m-d',
        'operational_mentions_count' => 'integer',
        'is_acting' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::saving(function (self $tenure): void {
            $tenure->setAttribute(
                'role_title_ar_fold',
                $tenure->role_title_ar === null ? null : ArabicSearch::fold((string) $tenure->role_title_ar),
            );
        });
    }

    public function official(): BelongsTo
    {
        return $this->belongsTo(GovtOfficial::class, 'official_id');
    }

    public function officeSlot(): BelongsTo
    {
        return $this->belongsTo(GovtOfficeSlot::class, 'office_slot_id');
    }

    public function institution(): BelongsTo
    {
        return $this->belongsTo(OfficialEntity::class, 'institution_id');
    }

    public function evidenceLinks(): HasMany
    {
        return $this->hasMany(GovtEvidenceLink::class, 'tenure_id')
            ->orderByDesc('published_date')
            ->orderBy('id');
    }
}
