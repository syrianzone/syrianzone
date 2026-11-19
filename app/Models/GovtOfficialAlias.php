<?php

namespace App\Models;

use App\Models\Concerns\FoldsSearchColumns;
use App\Support\ArabicSearch;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Alternate spelling, kunya, patronymic short form, or English name for a GovtOfficial.
 */
class GovtOfficialAlias extends Model
{
    use FoldsSearchColumns, HasFactory, HasUuids;

    protected $table = 'govt_official_aliases';

    protected $fillable = [
        'official_id',
        'alias_ar',
        'alias_type',
        'source_note',
    ];

    protected static function booted(): void
    {
        static::saving(function (self $alias): void {
            $alias->setAttribute(
                'alias_ar_fold',
                $alias->alias_ar === null ? null : ArabicSearch::fold((string) $alias->alias_ar),
            );
        });
    }

    public function official(): BelongsTo
    {
        return $this->belongsTo(GovtOfficial::class, 'official_id');
    }
}
