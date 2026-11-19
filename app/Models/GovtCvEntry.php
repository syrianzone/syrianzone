<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A structured CV entry (education, career history, military/revolutionary, civic/social,
 * certification, publication) for a GovtOfficial.
 */
class GovtCvEntry extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'govt_cv_entries';

    protected $fillable = [
        'official_id',
        'section',
        'title_ar',
        'organization_ar',
        'location_ar',
        'start_year',
        'end_year',
        'is_ongoing',
        'details_ar',
        'sort_order',
    ];

    protected $casts = [
        'start_year' => 'integer',
        'end_year' => 'integer',
        'is_ongoing' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function official(): BelongsTo
    {
        return $this->belongsTo(GovtOfficial::class, 'official_id');
    }
}
