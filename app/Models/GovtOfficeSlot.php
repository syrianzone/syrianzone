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
 * A government office slot (e.g. "وزير الطاقة", "محافظ دمشق") that can be held
 * by different officials over time, or merged/replaced into a successor slot.
 */
class GovtOfficeSlot extends Model
{
    use FoldsSearchColumns, HasFactory, HasUuids;

    protected $table = 'govt_office_slots';

    protected $fillable = [
        'slug',
        'title_ar',
        'institution_id',
        'institution_name_ar',
        'tier',
        'is_single_seat',
        'status',
        'active_from',
        'ended_at',
        'lineage_note_ar',
        'replaced_by_slot_id',
    ];

    protected $casts = [
        'is_single_seat' => 'boolean',
        'active_from' => 'date:Y-m-d',
        'ended_at' => 'date:Y-m-d',
    ];

    protected static function booted(): void
    {
        static::saving(function (self $slot): void {
            $slot->setAttribute(
                'title_ar_fold',
                $slot->title_ar === null ? null : ArabicSearch::fold((string) $slot->title_ar),
            );
        });
    }

    public function institution(): BelongsTo
    {
        return $this->belongsTo(OfficialEntity::class, 'institution_id');
    }

    public function replacedBy(): BelongsTo
    {
        return $this->belongsTo(self::class, 'replaced_by_slot_id');
    }

    public function tenures(): HasMany
    {
        return $this->hasMany(GovtTenure::class, 'office_slot_id')
            ->orderByDesc('started_at')
            ->orderByDesc('id');
    }
}
